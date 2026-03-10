
# 6 Correções Cirúrgicas no process-chat-flow — CONCLUÍDO (10/03/2026)

## Arquivo: `supabase/functions/process-chat-flow/index.ts`

### FIX 1 ✅ — Proteção contra loop flow-to-flow
### FIX 2 ✅ — condition_v2 reconhecido como waiting_input
### FIX 3 ✅ — Auto-traverse cobre condition_v2
### FIX 4 ✅ — Transfer node atualiza conversations.department
### FIX 5 ✅ — startMessage com replaceVariables
### FIX 6 ✅ — financialIntentPattern simplificado

---

# FIX 7 ✅ — aiExitForced segue próximo nó do chat flow (10/03/2026)

## Problema
Quando a IA no nó `ia_entrada` faz handoff (`forceAIExit`), o `findNextNode` busca edge `ai_exit` que não existe no Master Flow → conversa fica presa.

## Correções aplicadas

### 7a — Fallback edge default (process-chat-flow ~L2273)
Se `aiExitForced && !nextNode && path === 'ai_exit'`, tenta `findNextNode` com `path=undefined` (edge default).

### 7b — Guard final sem nó (process-chat-flow ~L2336)
Se mesmo com fallback não encontrou próximo nó, força handoff genérico com `department_id` do nó ou null.

### 7c — Safety net IA falha (process-buffered-messages ~L383)
Quando `ai-autopilot-chat` retorna HTTP error com flow ativo, re-invoca `process-chat-flow` com `forceAIExit: true`.

### 7d — Safety net IA falha (handle-whatsapp-event ~L1272)
Mesmo safety net no webhook Evolution: se `aiError` com flow context, re-invoca e envia mensagem do próximo nó.
