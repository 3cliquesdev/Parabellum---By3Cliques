

# Bug 38b: Auditoria Meta WhatsApp — Path L4934 faltando `skipInitialMessage`

## Diagnóstico da Conversa #FF7270C8

**Canal:** Meta WhatsApp (`whatsapp_provider: meta`)  
**Fluxo:** V5 Enterprise (`cafe2831`) → `node_menu_assunto` → `node_ia_financeiro`  
**Problema:** Cliente selecionou "2" (Financeiro), IA respondeu "Não encontrei informações específicas..." em vez de se apresentar.

### O que já estava correto

1. **`meta-whatsapp-webhook` L1148:** JÁ tem o check de `skipInitialMessage` desde V15 ✅
2. **`process-chat-flow` L2927-2960:** Transição `ask_options → ai_response` retorna `skipInitialMessage: true` ✅
3. **`ai-autopilot-chat` L1498:** Lógica de saudação proativa com mensagem vazia ✅

### Por que citei Evolution no Bug 38 anterior

Erro meu de diagnóstico — o `handle-whatsapp-event` (Evolution) de fato **não tinha** `skipInitialMessage`, mas a conversa #FF7270C8 é Meta. O fix do Evolution foi correto mas NÃO era o que afetou esta conversa.

### Possível causa real

A conversa aconteceu às 16:31 UTC. O mais provável é que o `process-chat-flow` não estava deployed com a versão enriquecida (Bug 38), e a IA recebeu o "2" sem `flow_context` adequado. Porém, encontrei um **bug real** que ainda precisa de correção:

### Bug encontrado: L4934 — Generic fallback sem `skipInitialMessage`

No `process-chat-flow`, após o auto-avanço de `message` nodes (intent-routing path L4620-4723), o response genérico em L4934-4944:

```javascript
return new Response(JSON.stringify({
  useAI: false,           // ❌ Deveria ser true
  response: allMessages,
  options,
  ...(nextNode.type === 'ai_response' ? { aiNodeActive: true } : {}),
  // ❌ Faltando: skipInitialMessage, personaId, kbProductFilter, etc.
}))
```

Este path é alcançado quando o fluxo faz `intent-routing → message → message → ai_response` (message chain). Faltam:
- `useAI: true`
- `skipInitialMessage: true`
- Todos os campos de configuração do nó AI

## Correção

**Arquivo:** `supabase/functions/process-chat-flow/index.ts` L4927-4944

Quando `nextNode.type === 'ai_response'`, retornar response completo com todos os campos, idêntico ao L2927-2960 e L4584-4618.

### Resumo: 1 arquivo, 1 edição

