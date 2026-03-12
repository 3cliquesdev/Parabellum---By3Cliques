

# Plano: Migrar todas as Edge Functions de Lovable AI Gateway para OpenAI direta

A `OPENAI_API_KEY` já está configurada no projeto. Vou refatorar **15 edge functions** para usar `https://api.openai.com/v1/chat/completions` diretamente em vez de `https://ai.gateway.lovable.dev/v1/chat/completions`.

## Mapeamento de modelos

Os modelos do gateway Lovable precisam ser convertidos para modelos OpenAI reais:

| Lovable Gateway Model | OpenAI Model |
|---|---|
| `openai/gpt-5-mini` | `gpt-4o-mini` |
| `openai/gpt-5` | `gpt-4o` |
| `openai/gpt-5-nano` | `gpt-4o-mini` |
| `google/gemini-*` | `gpt-4o-mini` (ou `gpt-4o` para tarefas complexas) |

## Edge Functions a refatorar

### Grupo 1 — Lovable-only (sem fallback OpenAI existente)
1. **analyze-ticket** — Sentimento, tags, resumo, reply
2. **generate-smart-reply** — Sugestões Copilot
3. **generate-kb-draft** — Artigos KB automáticos
4. **extract-knowledge-from-chat** — Extração de conhecimento
5. **ai-auto-trainer** — Auto-treinamento (chat completions)
6. **ai-chat-stream** — Chat streaming + embeddings
7. **whatsapp-window-keeper** — Mensagens de manutenção de janela
8. **import-octadesk** — Importação com IA
9. **process-knowledge-import** — Importação KB
10. **generate-batch-embeddings** — Extração de keywords
11. **generate-copilot-insights** — Insights do copiloto

### Grupo 2 — Já tem OpenAI como primário, remover fallback Lovable
12. **ai-autopilot-chat** — Já usa OpenAI primeiro, só limpar fallback
13. **expand-query** — Já usa OpenAI primeiro, remover fallback
14. **analyze-dashboard** — Já usa OpenAI primeiro, remover fallback
15. **generate-sales-insights** — Já usa OpenAI primeiro, remover fallback
16. **sandbox-chat** — Usa OpenAI ou Lovable dinamicamente

## Padrão de refatoração (para cada função)

```text
ANTES:
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}` },
    body: { model: 'openai/gpt-5-mini', ... }
  })

DEPOIS:
  const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
  fetch('https://api.openai.com/v1/chat/completions', {
    headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
    body: { model: 'gpt-4o-mini', ... }
  })
```

## Embeddings

Funções que usam embeddings via gateway (`ai-chat-stream`) serão apontadas para `https://api.openai.com/v1/embeddings` com `text-embedding-3-small` (já usado em outras funções como `train-ai-pair`).

## Impacto

- Zero mudança no frontend — todas as chamadas passam pelo `supabase.functions.invoke()`
- Custo passa a ser cobrado diretamente na conta OpenAI do usuário
- Sem dependência de créditos Lovable para funcionalidades de IA
- Erros 402 ("payment required") desaparecem imediatamente

