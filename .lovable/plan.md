
Analisei o projeto atual e sigo as regras da base de conhecimento.

Você está certo em cobrar: do jeito que está, o Autopilot entra em loop pedindo e-mail e não “evolui” o estado. Pela imagem, o e-mail está chegando quebrado em linha (ex: `lucassantanapontes27@gma` + quebra + `il.com`). O código atual do Autopilot só reconhece e-mail com um regex simples em `customerMessage`, então quando o WhatsApp/cliente quebra a string, **o regex não encontra**, o contato continua “sem email”, e o handoff volta a cair no bloco `isLeadWithoutEmail` → pedindo e-mail de novo. Isso explica exatamente o comportamento.

Abaixo está o plano para deixar isso 100% (sem downgrade), com proteção anti-loop e confirmação de que o e-mail foi processado.

## Objetivo
1) Autopilot reconhecer e-mails mesmo quando vêm com quebras/espaços do WhatsApp.
2) Quando a conversa estiver em “aguardando e-mail”, **não chamar o fluxo de handoff novamente** até processar (ou validar como inválido).
3) Dar resposta determinística ao usuário após receber o e-mail (cliente encontrado → menu / lead → encaminha comercial), sem repetir a mesma pergunta.
4) Adicionar logs claros para provar no log que “detectou e-mail / atualizou contato / marcou metadata”.

---

## Mudanças (backend function ai-autopilot-chat)
Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`

### 1) Criar um extrator de e-mail “tolerante” (WhatsApp-safe)
Implementar uma função utilitária local (no próprio arquivo) que:
- Tente extrair e-mail do texto “como veio”
- Se falhar, tente extrair do texto “compactado” (removendo espaços e quebras de linha)

Exemplo de estratégia:
- `originalMatch = original.match(emailRegex)`
- `compact = original.replace(/\s+/g, '')`
- `compactMatch = compact.match(emailRegex)`
- Se encontrar no `compact`, usar esse valor

Importante: manter o regex atual, apenas trocar a origem do match para incluir o “compact”.

### 2) Priorizar processamento de e-mail quando `awaiting_email_for_handoff === true`
Hoje o Autopilot pode cair no low-confidence/handoff e pedir e-mail novamente.
Ajuste:
- Logo no começo do fluxo (antes de rodar decisão de confiança/handoff/LLM), checar:
  - `conversation.customer_metadata?.awaiting_email_for_handoff === true`
- Se estiver aguardando e-mail:
  - Tentar extrair e-mail com o extrator tolerante
  - Se **não encontrar** e-mail → responder **uma mensagem de “email inválido”** (ex: “Envie sem espaços/quebras”) e retornar early, sem entrar no handoff de novo
  - Se **encontrar** e-mail → executar o mesmo caminho já existente (`verify-customer-email` + updates) e ao final:
    - Limpar o estado `awaiting_email_for_handoff` do metadata (para não ficar preso)
    - Retornar early (sem passar pelo LLM)

Isso garante que “aguardando e-mail” vira um estado determinístico: ou valida e segue, ou pede correção do formato.

### 3) Ao pedir e-mail, adicionar “anti-spam” (não reenviar igual sempre)
Quando `isLeadWithoutEmail` for verdadeiro e o sistema for pedir e-mail:
- Se `awaiting_email_for_handoff` já estiver `true` e `handoff_blocked_at` for recente (ex: < 60s), não repetir a mesma mensagem.
- Em vez disso, pode apenas retornar status `awaiting_email` sem inserir nova mensagem duplicada (ou mandar uma variação curta “Ainda preciso do e-mail…”).
Isso evita “rajada” de mensagens repetidas se o usuário mandar algo que não contém e-mail.

### 4) Logs de diagnóstico para fechar a conta
Adicionar logs específicos:
- Quando `awaiting_email_for_handoff` estiver ativo
- Resultado da extração (original vs compact)
- Resultado do `verify-customer-email`
- Quando limpar `awaiting_email_for_handoff`

Esses logs são essenciais para provar que “processou” e parar de repetir.

---

## (Opcional, mas recomendado) Ajuste no template de pedido de e-mail
Como a dor é WhatsApp quebrar texto, o template pode orientar:
- “Envie o e-mail em uma única linha, sem espaços”
Isso não substitui a correção, mas reduz ocorrência.

---

## Verificação do bug do print (critério de aceite)
Cenário real (igual ao print):
1) IA pede e-mail
2) Cliente envia: `lucassantanapontes27@gma` + quebra + `il.com`
3) Sistema deve:
   - Reconhecer via “compact”
   - Atualizar contato / metadata
   - Responder algo diferente de “me informe o email”:
     - Se cliente encontrado: mensagem de confirmação + menu
     - Se não encontrado: encaminhar comercial e mudar ai_mode / department conforme regra

Se após isso ele voltar a pedir e-mail, o bug persiste.

---

## Escopo adicional (seu item antigo do Inbox “buscar por nome”)
Isso é um segundo problema e também é real:
- `useInboxView` aplica busca corretamente, mas `Inbox.tsx` ainda renderiza `filteredConversations` vindo de `useConversations`, então a busca por nome pode “não pegar”.
Depois que o e-mail loop estiver 100%, eu proponho (como upgrade separado) ligar a UI da lista ao `inboxItems` filtrado (isso também melhora realtime e WhatsApp).

---

## Testes que serão realizados (obrigatórios)
No ambiente de preview, antes de entregar:
1) Simular mensagem WhatsApp com e-mail normal (uma linha) → deve identificar.
2) Simular mensagem WhatsApp com e-mail quebrado por newline (como no print) → deve identificar.
3) Simular “awaiting_email_for_handoff” + mensagem sem e-mail (ex: “ok”) → deve responder “email inválido/mande email” sem duplicar spam e sem handoff.
4) Garantir que continua funcionando:
   - Chat flows
   - Roteamento de departamento
   - Menu pós-identificação
   - Handoff manual bloqueado sem identificação (mantém segurança)
5) Conferir logs do backend para ver extração e limpeza do estado.

---

## Entregáveis
- Ajuste no `ai-autopilot-chat/index.ts` (extração tolerante + estado awaiting_email_for_handoff determinístico + anti-loop).
- (Opcional) Ajuste no template `identity_wall_ask_email` para orientar formato no WhatsApp.

Risco de downgrade: baixo. As mudanças são aditivas e focadas em robustez do fluxo de identificação, preservando toda a arquitetura existente (RAG, flows, roteamento, etc.).
