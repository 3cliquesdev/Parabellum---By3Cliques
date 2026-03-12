

# Plano: 5 Fixes Críticos Anti-Alucinação e Estabilidade

## Escopo

5 correções em 6 edge functions + 1 nova edge function.

---

## FIX 1 — Payload contract: `userMessage` → `customerMessage`

### `meta-whatsapp-webhook/index.ts`
- ~15 ocorrências de `userMessage` em invocações de `ai-autopilot-chat` (linhas ~737, 1253, 1320, 1461, 1525, 1636, 1700, 1827, 1969, 2005, 2055, 2220, 2245, 2270, etc.)
- Renomear todas para `customerMessage`

### `handle-whatsapp-event/index.ts`
- 3 ocorrências (linhas ~1254, 1356, 1413)
- Renomear todas para `customerMessage`

### `ai-autopilot-chat/index.ts`
- Adicionar validação hard logo após o warmup check (~L1459), antes de qualquer processamento:
  - Se `customerMessage` vazio/ausente e não for warmup → retornar 400 `BAD_REQUEST`

---

## FIX 2 — Dispatch reconciliation: zero conversas órfãs

### `transition-conversation-state/index.ts`
- Após o bloco `shouldCreateDispatch` existente (~L130), adicionar uma verificação guarantee: se a transição foi `handoff_to_human` e não encontrou job existente `pending`/`escalated`, criar um novo

### `dispatch-conversations/index.ts`
- Adicionar rotina de reconciliação no início do ciclo (~L62, antes do fetch de pending jobs):
  - Query: conversas com `ai_mode='waiting_human'`, `status='open'`, `assigned_to IS NULL`
  - Para cada uma sem dispatch job `pending`/`escalated`, criar job
  - Log `[RECONCILE]`

---

## FIX 3 — Queue hygiene: remover registros mortos

### `route-conversation/index.ts`
- Na query de posição na fila (~L791-796), adicionar join/filter para excluir conversas fechadas
- Adicionar limpeza de `conversation_queue` entries de conversas já fechadas no início do `route-conversation` ou no `dispatch-conversations`

### `dispatch-conversations/index.ts`
- Adicionar cleanup de queue entries de conversas fechadas no início do ciclo de dispatch (mais eficiente que no route)

---

## FIX 4 — Telemetria anti-alucinação

### `ai-autopilot-chat/index.ts`
- Adicionar log estruturado `ai_decision` nos 6 pontos de decisão:
  1. Zero confidence guard
  2. Strict RAG handoff
  3. Confidence handoff (`flow_advance_needed`)
  4. Fallback phrase detection
  5. Restriction violation (contrato)
  6. Anti-loop (`ai_node_fallback_count >= 5`)
- Formato: `JSON.stringify({ event: 'ai_decision', conversation_id, reason, score, hasFlowContext, exitType, fallback_used, articles_found, timestamp })`

---

## FIX 5 — Nova edge function `health-check-ai`

### `supabase/functions/health-check-ai/index.ts`
- Endpoint protegido por `SUPABASE_SERVICE_ROLE_KEY`
- Retorna JSON com 5 métricas:
  1. Conversas órfãs (`waiting_human` + sem `assigned_to` + sem dispatch job ativo)
  2. Jobs escalados por departamento
  3. Queue entries de conversas fechadas (deve ser 0)
  4. Últimos 100 logs `ai_decision` com breakdown por `reason`
  5. `flow_advance_needed` nas últimas 24h vs total de respostas

---

## Arquivos editados

| Arquivo | Tipo de mudança |
|---|---|
| `meta-whatsapp-webhook/index.ts` | ~15 renomeações `userMessage` → `customerMessage` |
| `handle-whatsapp-event/index.ts` | 3 renomeações `userMessage` → `customerMessage` |
| `ai-autopilot-chat/index.ts` | Validação 400 + 6 logs de telemetria |
| `transition-conversation-state/index.ts` | Guarantee block no handoff |
| `dispatch-conversations/index.ts` | Reconciliação de órfãs + limpeza de queue |
| `route-conversation/index.ts` | Filtro de conversas fechadas na posição de fila |
| `health-check-ai/index.ts` | **NOVO** — endpoint de health check |

