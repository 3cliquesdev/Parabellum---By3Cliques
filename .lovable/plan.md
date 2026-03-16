

# Bug: IA perde contexto do fluxo (collectedData nao chega ao prompt)

## Causa Raiz

O `process-chat-flow` retorna `collectedData` como campo **top-level** na resposta (ex: `{ useAI: true, aiNodeActive: true, collectedData: { produto: "Drop Nacional", assunto: "Pedidos" }, ... }`).

Porem o `meta-whatsapp-webhook` (linha ~1212) constroi o `flow_context` que sera enviado ao `ai-autopilot-chat` **sem incluir o `collectedData`**:

```text
flow_context: {
  flow_id, node_id, node_type, allowed_sources,
  personaId, kbCategories, contextPrompt, objective,
  forbidQuestions, forbidOptions, forbidFinancial, ...
  // ❌ collectedData AUSENTE!
}
```

No `ai-autopilot-chat` (linha ~6616), o bloco `flowCollectedDataBlock` tenta ler `flow_context?.collectedData` e nao encontra nada. Resultado: o contexto "produto escolhido", "assunto escolhido", e quaisquer dados coletados nos menus **nunca chegam ao system prompt da IA**.

A IA entao "alucina" porque nao sabe qual produto/assunto o cliente escolheu.

## Correcao

### 1. `supabase/functions/meta-whatsapp-webhook/index.ts` (~linha 1212)

Adicionar `collectedData` ao objeto `flow_context` passado para `ai-autopilot-chat`:

```
collectedData: (flowData as any).collectedData || null,
```

Isso precisa ser adicionado em **3 locais**:
- Chamada direta ao ai-autopilot-chat (linha ~1212, dentro do objeto flow_context)
- Buffer de batching (linha ~1162, dentro de `flowData`)

### 2. `supabase/functions/process-buffered-messages/index.ts` (se existir)

Verificar se o cron de batching tambem reconstroi `flow_context` com `collectedData` a partir do `flowData` salvo no buffer.

### 3. Verificar `ai-autopilot-chat` interno (linha ~3480)

Quando `ai-autopilot-chat` chama `process-chat-flow` internamente e recebe `flowResult.useAI === true`, ele popula `flowPersonaId`, `flowKbCategories`, etc. mas **tambem nao popula `flow_context.collectedData`** - porque nao cria um objeto `flow_context` nesse caminho (usa as variaveis individuais). O bloco `flowCollectedDataBlock` na linha 6616 depende de `flow_context?.collectedData`, que so existe quando `flow_context` veio no body do request.

**Solucao**: No caminho interno (linha ~3480), alem de popular as variaveis individuais, tambem criar/complementar o `flow_context` com os dados do fluxo:

```typescript
if (flowResult.useAI === true) {
  // ... codigo existente ...
  // 🆕 Garantir que collectedData chega ao prompt
  if (!flow_context && flowResult.collectedData) {
    flow_context = {
      flow_id: flowResult.flowId,
      node_id: flowResult.nodeId,
      node_type: 'ai_response',
      allowed_sources: flowResult.allowedSources || ['kb'],
      response_format: 'text_only',
      collectedData: flowResult.collectedData,
      // ... demais campos
    };
  }
}
```

## Resumo de Arquivos

| Arquivo | Acao |
|---|---|
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Adicionar `collectedData` ao `flow_context` (linha ~1212 e ~1162) |
| `supabase/functions/ai-autopilot-chat/index.ts` | Criar `flow_context` no caminho interno quando `process-chat-flow` retorna `useAI: true` (linha ~3480) |

## Impacto

- A IA passara a saber qual produto, assunto e outros dados o cliente ja escolheu nos menus
- Elimina alucinacoes por falta de contexto
- Nenhuma mudanca no frontend ou no process-chat-flow (ja retorna tudo corretamente)

