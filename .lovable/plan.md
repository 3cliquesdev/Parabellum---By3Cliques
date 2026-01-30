
Analisei o projeto atual e sigo as regras da base de conhecimento.

Objetivo do ajuste: fazer o WhatsApp (Meta) “seguir o fluxo” de verdade, usando a mesma arquitetura soberana que você já tem no Web Chat: **process-chat-flow primeiro**, e só depois (se e somente se) o fluxo permitir, chamar IA. Hoje o `meta-whatsapp-webhook` salva a mensagem e chama `ai-autopilot-chat` direto, então o fluxo pode ser ignorado.

## Diagnóstico (por que não está seguindo o fluxo)
1) **WhatsApp não passa pelo `message-listener`**
- O `message-listener` deliberadamente “pula” WhatsApp (`channel === 'whatsapp'`) com log “já processado por webhook”.
- Ou seja: toda a regra “Flow soberano → IA só se aiNodeActive=true” **não roda** para WhatsApp.

2) **`meta-whatsapp-webhook` chama a IA direto**
No arquivo `supabase/functions/meta-whatsapp-webhook/index.ts`, o pipeline atual é:
- encontra/cria conversa
- salva mensagem
- (agora) checa kill switch antes de IA
- **se ai_mode === 'autopilot'** → chama `ai-autopilot-chat` diretamente

Resultado: o cliente pode receber resposta da IA ou mensagens fora do “Master Flow” porque o fluxo nem foi consultado.

## O que vamos corrigir (upgrade sem quebrar o existente)
Vamos implementar no `meta-whatsapp-webhook` o mesmo padrão do `message-listener`:

### A) Chamar `process-chat-flow` antes de qualquer decisão de automação
Depois de salvar a mensagem (e depois do Kill Switch, que já está no lugar), vamos:
- chamar `process-chat-flow` com `{ conversationId, userMessage }`
- analisar o retorno:
  - `skipAutoResponse: true` → não enviar nada (e garantir `ai_mode = waiting_human`)
  - `useAI: false` + `response` → **enviar a resposta do fluxo** pelo WhatsApp (usando `send-meta-whatsapp`)
  - `useAI: true` + `aiNodeActive: true` → chamar `ai-autopilot-chat` **com flow_context**
  - sem fluxo e sem AIResponseNode → fallback controlado (opcional) + mover para humano (mantendo o padrão atual do seu sistema)

### B) Garantir “IA só roda se o fluxo permitir” também no WhatsApp
Ou seja, substituir a condição atual:
- `if (conversation.ai_mode === "autopilot" && !conversation.awaiting_rating) { call ai-autopilot-chat }`
por:
- `if (conversation.ai_mode === "autopilot" && !conversation.awaiting_rating && flowData.useAI && flowData.aiNodeActive) { call ai-autopilot-chat com flow_context }`

### C) Responder mensagens de fluxo via WhatsApp do jeito correto (sem duplicar persistência)
Para WhatsApp Meta, a regra correta é: **quem envia e persiste outbound é o `send-meta-whatsapp`** (single source of truth).
Então, quando `process-chat-flow` retornar `response`, vamos:
- chamar `send-meta-whatsapp` com:
  - `instance_id: instance.id`
  - `phone_number: fromNumber`
  - `message: flowData.response`
  - `conversation_id: conversation.id`
  - `skip_db_save: false` (para persistir corretamente a mensagem enviada e evitar inserts manuais duplicados)

### D) Ajuste de consistência: não “reabrir” conversa fechada de forma agressiva
Hoje, ao encontrar conversa existente, o webhook força:
- `status: "open" // Reabrir se estava fechada`
Mas ao mesmo tempo ele faz `.neq("status", "closed")`, então essa reabertura é meio incoerente e pode atrapalhar estados.
Vamos revisar esse trecho e alinhar com a regra de produto:
- manter fechado quando `awaiting_rating=true` (já coberto pelo CSAT guard)
- e definir de forma clara quando reabre/quando cria nova (sem mudar comportamento atual sem necessidade; apenas remover inconsistências)

## Arquivos envolvidos
- `supabase/functions/meta-whatsapp-webhook/index.ts` (principal)
- (sem mudança planejada agora) `supabase/functions/process-chat-flow/index.ts`
- (sem mudança planejada agora) `supabase/functions/ai-autopilot-chat/index.ts`

## Sequência de implementação (passo a passo)
1) No `meta-whatsapp-webhook`, localizar o ponto após salvar a mensagem inbound.
2) Manter o Kill Switch já existente (ele está correto e cedo o suficiente antes da IA).
3) Inserir chamada ao `process-chat-flow`:
   - `fetch(`${SUPABASE_URL}/functions/v1/process-chat-flow`...)` com service role
4) Interpretar `flowData` e tomar decisão:
   - se `flowData.skipAutoResponse` → update `ai_mode=waiting_human` e `continue`
   - se `!flowData.useAI && flowData.response` → `send-meta-whatsapp` com `skip_db_save:false` e `continue`
   - se `flowData.useAI && flowData.aiNodeActive` → chamar `ai-autopilot-chat` com `flow_context` (espelhando o contrato do message-listener)
   - se não tem flow/aiNodeActive → fallback (se IA estiver ligada) + `waiting_human`
5) Revisar o trecho que “reabre conversa” para remover inconsistência com a query que ignora `closed`.
6) Adicionar logs `[AUTO-DECISION]` no WhatsApp também (mesmo formato do message-listener), para auditoria.

## Testes obrigatórios (regressão zero)
Vou validar os cenários abaixo:

1) IA Global OFF (Kill Switch OFF):
- Cliente manda mensagem no WhatsApp
- Resultado esperado:
  - nenhuma resposta automática
  - conversa vai para `waiting_human`
  - o fluxo não manda mensagem
  - a IA não roda

2) IA Global ON + Shadow Mode ON:
- Cliente manda mensagem que ativa um AIResponseNode no fluxo
- Resultado esperado:
  - fluxo decide `aiNodeActive=true`
  - IA gera sugestão (sem enviar automaticamente, conforme seu Shadow Mode)
  - nenhum texto automático é disparado se a arquitetura atual já bloqueia “apply”

3) Fluxo com resposta estática (Message/AskOptions etc.):
- Cliente manda mensagem que o fluxo consegue responder sem IA
- Resultado esperado:
  - `process-chat-flow` retorna `response`
  - `send-meta-whatsapp` envia exatamente essa resposta
  - IA não é chamada

4) CSAT (já corrigido) continua estável:
- conversa fechada + awaiting_rating=true
- cliente manda “5”
- Resultado esperado:
  - não cria novo chat
  - salva rating
  - envia agradecimento
  - não roda fluxo nem IA

## Resultado esperado final (arquitetura ideal)
- WhatsApp Meta passa a respeitar o “Flow soberano”
- IA só roda quando o fluxo permitir (`aiNodeActive=true`)
- Kill Switch bloqueia tudo (IA/fluxo/fallback) também no WhatsApp
- Zero mensagens duplicadas / fora do fluxo

