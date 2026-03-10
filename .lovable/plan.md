

# Fix: Mensagens de fluxo renderizando como "nota interna" em vez de bolha de chat

## O Problema

Na screenshot, aparecem **duas versões** da mesma mensagem:
1. **Bolha branca** (correta) — "Vou te direcionar para nosso menu de atendimento..." — renderizada como `MessageBubble` normal
2. **Mensagem pequena com 🚩** (incorreta) — mesma frase, mas renderizada como pill centralizada do tipo "system"

Isso acontece porque o fluxo (process-chat-flow e handle-whatsapp-event) está salvando mensagens enviadas ao cliente com `sender_type: 'system'`. No frontend, mensagens `system` são renderizadas como pills centralizadas pequenas (linha 215-224 de `MessagesWithMedia.tsx`), não como bolhas de chat.

**Todas as mensagens visíveis ao cliente devem aparecer como bolhas de chat**, não como notas internas.

## Causa Raiz

3 locais no backend salvam mensagens de fluxo como `sender_type: 'system'` quando deveriam ser `sender_type: 'user'`:

1. **`process-chat-flow/index.ts` linha 2198** — fallback_message do nó AI
2. **`process-chat-flow/index.ts` linha 2928** — mensagens acumuladas pré-transferência
3. **`handle-whatsapp-event/index.ts` linha 1326** — mensagem do próximo nó do fluxo após AI exit

## Correções

### 1. Alterar sender_type de 'system' para 'user' nas 3 localizações

**`process-chat-flow/index.ts`** (2 locais):
- Linha 2198: `sender_type: 'system'` → `sender_type: 'user'`
- Linha 2928: `sender_type: 'system'` → `sender_type: 'user'`

**`handle-whatsapp-event/index.ts`** (1 local):
- Linha 1326: `sender_type: 'system'` → `sender_type: 'user'`

**Nota**: NÃO alterar as mensagens system que são realmente internas (teste de fluxo, conexão WhatsApp, OTP, alertas de segurança). Apenas as que são enviadas ao cliente como resposta de fluxo.

### 2. Resultado Esperado

Todas as mensagens de fluxo enviadas ao cliente (fallback, pré-transferência, nó seguinte) aparecerão como bolhas de chat normais do lado do atendente, em vez de pills centralizadas que parecem notas internas.

