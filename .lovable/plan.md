

# Fix: Opções do nó de escape não são enviadas junto com a mensagem de fallback

## Problema
Quando a IA no nó financeiro não consegue resolver, ela responde "Não consegui resolver por aqui. O que prefere fazer?" — mas **sem as opções** (↩ Voltar ao menu / 👤 Falar com atendente). O cliente fica sem saber o que fazer.

**Causa raiz**: No `ai-autopilot-chat`, quando uma "restriction violation" é detectada (linha ~10128), a resposta é substituída pelo `fallbackMessage` do nó e a IA **permanece no nó atual** em vez de avançar para o `node_escape_financeiro` (que tem as opções). As opções só são incluídas quando `process-chat-flow` avança para o nó `ask_options`, mas isso nunca acontece nesse cenário.

## Solução

### 1. `ai-autopilot-chat`: Sinalizar `flowExit` quando fallback é acionado dentro de fluxo
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

Na seção de "restriction violation" (linha ~10128), em vez de substituir a mensagem e ficar no nó, retornar `flowExit: true` para que o webhook re-invoque `process-chat-flow` com `forceAIExit: true`. Isso faz o motor de fluxos avançar para o `node_escape_financeiro` e devolver fallback + opções combinados.

Alteração (~linha 10127-10131):
```typescript
// ANTES: substituía e ficava no nó
assistantMessage = fallbackMessage;
isFallbackResponse = true;

// DEPOIS: sinalizar flow exit para que process-chat-flow avance ao escape node
console.log('[ai-autopilot-chat] 🔄 VIOLAÇÃO DE RESTRIÇÃO + flow_context → flowExit para avançar ao escape node');
return new Response(JSON.stringify({
  flowExit: true,
  reason: 'restriction_violation_exit',
  hasFlowContext: true,
  response: null, // process-chat-flow vai montar a mensagem com opções
  conversationId,
}), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } });
```

### 2. Adicionar pattern de fallback no `ESCAPE_PATTERNS`
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

Adicionar um novo pattern para detectar quando a IA ecoa o fallback_message do nó (caso ela gere o texto por conta própria em vez de emitir `[[FLOW_EXIT]]`):

```typescript
// Na lista ESCAPE_PATTERNS (~linha 1458):
/n[aã]o\s+consegu[ií]\s+resolver/i,
```

### 3. Garantir que o `isFallbackResponse` também trigge flowExit no final
**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`

Na seção onde `isFallbackResponse` é verificado contra o anti-loop counter (~linha 9570+), se o fallback for detectado E estiver dentro de um fluxo com `flow_context`, retornar `flowExit: true` ao invés de enviar a mensagem truncada. Isso garante que o `process-chat-flow` sempre monte a resposta com as opções do nó de escape.

### 4. Deploy
- `ai-autopilot-chat`

## Resultado esperado
- Quando a IA não consegue resolver, a mensagem enviada será: "Não consegui resolver por aqui.\n\nO que prefere fazer?\n\n1️⃣ ↩ Voltar ao menu\n2️⃣ 👤 Falar com atendente"
- O fluxo avança corretamente para o nó de escape com as opções visíveis

