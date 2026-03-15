

# Bug: Widget do Portal usa Master Flow em vez de responder diretamente

## Problema
Quando o widget envia uma mensagem via `ai-autopilot-chat`, a função **sempre** chama `process-chat-flow` primeiro (Prioridade 1). O `process-chat-flow` encontra o Master Flow ativo e processa a triagem da persona Clicker ("Você já é nosso cliente? 1. Sim 2. Não"), ignorando completamente o `flow_context` que o widget enviou.

O fluxo atual:
```text
Widget → ai-autopilot-chat → process-chat-flow → Master Flow (Clicker) → "Transferir..."
                                  ↑ AQUI o flow_context do widget é ignorado
```

## Correção

### Editar `supabase/functions/ai-autopilot-chat/index.ts`
Na seção "PRIORIDADE 1: CHAT FLOW" (linha ~3261), adicionar um guard que **pula** a chamada ao `process-chat-flow` quando `flow_context` já foi fornecido no request body:

```typescript
// Se flow_context foi fornecido explicitamente (ex: widget do portal),
// NÃO chamar process-chat-flow — usar o contexto direto
if (!flow_context) {
  // ... chamada existente ao process-chat-flow ...
}
```

Isso garante que:
- **Widget do portal**: usa o `flow_context` direto com seu `contextPrompt` de especialista, respondendo via KB sem passar pelo Master Flow
- **WhatsApp e outros canais**: continuam passando pelo Master Flow normalmente (sem `flow_context` no body)

### Redeployar `ai-autopilot-chat`

## Impacto
- Widget do portal responderá diretamente usando a Base de Conhecimento
- Zero impacto no fluxo WhatsApp (que não envia `flow_context`)
- 1 arquivo editado, ~3 linhas alteradas

