

# Auditoria Conversa #2D12F4F9 — 2 Bugs Identificados

## Problema Observado
1. Cliente digitou "1" → IA respondeu "Pode repetir sua mensagem?" (resposta vazia)
2. Cliente digitou "Sem contexto ainda" e "Mds" → **nenhuma resposta**

## Bug 1: `callStrictRAG` usa `gpt-5` direto com 400 tokens (CRÍTICO — causa "Pode repetir")

**Evidência nos logs:**
```
[callStrictRAG] ⚠️ GPT-5 retornou resposta vazia - forçando handoff
[ai-autopilot-chat] ⚠️ IA retornou vazio — tentando retry com prompt reduzido
[ai-autopilot-chat] ❌ Retry também retornou vazio
```

**Causa:** `callStrictRAG` (linha 4264) faz chamada direta à OpenAI com `model: 'gpt-5'` e `max_completion_tokens: 400`. Isso **bypassa** toda a normalização do `callAIWithFallback`. O modelo `gpt-5` é um reasoning model cujos tokens de raciocínio interno contam contra o limite — 400 tokens é insuficiente, resultando em resposta vazia.

**Correção em `supabase/functions/ai-autopilot-chat/index.ts` (linha 4269):**
```typescript
// DE:
max_completion_tokens: 400

// PARA:
max_completion_tokens: 1200
```

O Strict RAG precisa de mais margem porque o `gpt-5` gasta tokens no reasoning chain antes de produzir output visível.

---

## Bug 2: Mensagens "Sem contexto ainda" e "Mds" nunca chegaram ao `ai-autopilot-chat` (CRÍTICO — sem resposta)

**Evidência:**
- `process-chat-flow` processou ambas as mensagens (logs confirmam `node_ia_pedidos`)
- `process-chat-flow` retornou `useAI: true, aiNodeActive: true`
- **Zero logs** de `ai-autopilot-chat` para essas mensagens
- O webhook `meta-whatsapp-webhook` não registrou nenhuma invocação de `ai-autopilot-chat` nesse período

**Causa provável:** O Message Batching está engolindo as mensagens. O buffer acumula as mensagens mas o timer/processamento do buffer falha silenciosamente ou o buffer nunca é processado. Preciso verificar a função de buffer e o cron/timer associado.

**Investigação adicional necessária:** Verificar:
1. A função `bufferAndSchedule` no webhook
2. O valor de `batchDelaySeconds` para essa instância
3. Se existe um `process-message-buffer` ou equivalente que processa o buffer

**Correção preliminar:** Se o batching está silenciosamente descartando mensagens, adicionar fallback direto quando o buffer falha, ou verificar se o timer está sendo criado corretamente.

---

## Resumo

| # | Arquivo | Linha | Bug | Severidade |
|---|---------|-------|-----|------------|
| 1 | `ai-autopilot-chat/index.ts` | 4269 | `callStrictRAG` com `max_completion_tokens: 400` insuficiente para gpt-5 | **CRÍTICO** |
| 2 | `meta-whatsapp-webhook/index.ts` | ~1169 | Mensagens perdidas no batching — IA nunca invocada | **CRÍTICO** |

## Ação Imediata
- Bug 1: Aumentar `max_completion_tokens` para `1200` no `callStrictRAG`
- Bug 2: Preciso investigar mais a fundo o mecanismo de buffer (`bufferAndSchedule`, o cron de processamento, e o valor de `batchDelaySeconds`) para identificar onde as mensagens estão sendo perdidas. Posso fazer isso na próxima iteração.

