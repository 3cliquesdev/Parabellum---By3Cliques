
## Plano urgente — Correção do fluxo financeiro (#EE1426A1)

### Diagnóstico confirmado
No caso `ee1426a1-8f7d-4fc0-975b-2997b9b05fd2`, o fluxo quebrou em 4 pontos:

- A conversa entrou no nó financeiro e a apresentação inicial saiu corretamente.
- Após `Quero sacar` + OTP válido, a resposta foi **genérica**: “Agora posso te ajudar com questões financeiras. Como posso te ajudar?”, em vez de iniciar a coleta.
- Quando o cliente repetiu `Quero sacar`, a IA caiu em **fallback_phrase_detected** e o flow avançou para `node_escape_financeiro`.
- A mensagem final saiu com **channel = web_chat** dentro de uma conversa WhatsApp.
- O fluxo terminou em `chat_flow_states.current_node_id = node_escape_financeiro`, sem ticket criado.
- O nó `node_ia_financeiro` está configurado com:
  - `smart_collection_enabled = true`
  - `ticket_config.department_id = b7149bf4...`
  - `ticket_config.assigned_to = ce6150bb...`
  - `fallback_message = "Não consegui resolver por aqui."`

### Causas raiz
1. **Resposta pós-OTP ainda está hardcoded**
   - O bloco de validação OTP em `ai-autopilot-chat` ainda usa resposta fixa.
   - Ele não usa `ticketConfig.description_template`, nem `smartCollectionFields`, nem força a coleta ao detectar saque.

2. **Fallback da IA continua expulsando o cliente do nó financeiro**
   - Após o segundo `Quero sacar`, a IA caiu em `fallback_phrase_detected`.
   - O `process-chat-flow` interpretou isso como `ai_handoff_exit` e avançou para o escape node.
   - Para fluxo financeiro pós-OTP, isso está errado: deveria **repetir/iniciar a coleta**, não mandar para escape/humano.

3. **Canal de mensagem está vazando para `web_chat`**
   - Existe insert hardcoded com `channel: 'web_chat'` no `process-chat-flow`.
   - Isso bate com a mensagem errada registrada na conversa.

4. **Roteamento/departamento do contexto financeiro ainda não está blindado**
   - A conversa está em departamento `36ce66cd...` (Suporte), enquanto o nó financeiro define `ticket_config.department_id = b7149bf4...`.
   - Mesmo antes do ticket, o contexto do atendimento já deveria refletir o destino correto do nó financeiro.

---

## Implementação em fases

### Fase 1 — Corrigir o pós-OTP financeiro
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

Ajustar o bloco de sucesso do OTP para:

- detectar `otp_reason === 'withdrawal'` ou intenção de saque no histórico/mensagem atual;
- usar **o mesmo template do nó** (`flow_context.ticketConfig.description_template`) como resposta pós-OTP;
- priorizar `smartCollectionEnabled` / `smartCollectionFields` quando presentes;
- remover a resposta genérica “Como posso te ajudar?” para contexto financeiro pós-OTP.

**Resultado esperado:** depois do código validado, o cliente já recebe a coleta correta do saque, sem precisar repetir “Quero sacar”.

---

### Fase 2 — Impedir regressão para o escape node
**Arquivos:**
- `supabase/functions/ai-autopilot-chat/index.ts`
- `supabase/functions/process-chat-flow/index.ts`

Blindar o cenário:
- nó financeiro ativo
- OTP já validado
- cliente pede saque
- IA retornou fallback/frase vazia/incerta

Nessa condição, o sistema deve:
- **não** marcar `ai_handoff_exit`;
- **não** avançar para `node_escape_financeiro`;
- responder deterministicamente com a coleta do saque;
- manter o flow em `node_ia_financeiro`.

**Resultado esperado:** “Quero sacar” pós-OTP nunca mais vira “Não consegui resolver por aqui”.

---

### Fase 3 — Padronizar canal correto nas mensagens do flow
**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

Substituir inserts hardcoded de mensagem do fluxo para usar:
- `conversation.channel` quando existir
- fallback apenas se realmente não houver canal

Também revisar os pontos que combinam:
- `pendingFallbackMsg`
- `extraMessages`
- respostas de escape/transferência

**Resultado esperado:** nenhuma mensagem de conversa WhatsApp será salva como `web_chat`.

---

### Fase 4 — Sincronizar departamento/atribuição do contexto financeiro
**Arquivos:**
- `supabase/functions/process-chat-flow/index.ts`
- possivelmente `supabase/functions/ai-autopilot-chat/index.ts`

Ao entrar no nó financeiro ou ao confirmar OTP para fluxo financeiro:
- sincronizar `conversation.department` com o destino do nó/contexto;
- priorizar `ticketConfig.department_id` quando existir;
- preservar `ticketConfig.assigned_to` para criação determinística e tool-based.

**Resultado esperado:** o atendimento e o ticket passam a seguir o departamento/usuário configurados no nó, não o departamento residual da conversa.

---

## Checklist de validação
Validar este roteiro após a implementação:

```text
Boa noite
1
2
Quero sacar
[código OTP]
```

Esperado:
1. Saudação da IA financeira
2. Pedido de OTP
3. OTP validado
4. Coleta enviada imediatamente com o template do nó
5. Se o cliente repetir “Quero sacar”, o sistema continua na coleta e não sai para escape
6. Mensagens salvas com `channel = whatsapp`
7. Ticket criado no departamento/usuário configurados no nó
8. Conversa não cai em `copilot` por fallback indevido

---

## Detalhes técnicos
### Pontos exatos a alterar
- **`ai-autopilot-chat/index.ts`**
  - bloco de OTP success que hoje ainda monta resposta genérica pós-validação;
  - guard de fallback financeiro pós-OTP;
  - possível reaproveitamento do `ticketConfig.description_template`.

- **`process-chat-flow/index.ts`**
  - tratamento de `aiExitForced` / `pendingFallbackMsg` em nó `ai_response`;
  - inserts de mensagens com canal hardcoded;
  - sync de departamento ao entrar/manter nó financeiro.

### Critério de sucesso
O fluxo financeiro precisa obedecer esta sequência sem desvios:

```text
Apresentação -> intenção de saque -> OTP -> coleta estruturada -> ticket -> confirmação
```

Sem:
- resposta genérica pós-OTP,
- escape prematuro,
- handoff indevido,
- canal `web_chat`,
- perda de departamento/atribuição.
