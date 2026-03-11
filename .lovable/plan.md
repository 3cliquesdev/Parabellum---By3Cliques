
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

---

# FIX 8 ✅ — pg_cron matando flows prematuramente (11/03/2026)

## Problema
O pg_cron `cleanup-stuck-flow-states` usava `started_at < now() - 3 min`, mas `started_at` é imutável. Flows com múltiplos passos (>3min) eram mortos antes de chegar ao nó de transfer.

## Correções aplicadas

### 8a — Coluna `updated_at` em `chat_flow_states`
Nova coluna `updated_at timestamptz DEFAULT now()` adicionada via migration. Registros existentes backfilled com `COALESCE(completed_at, started_at)`.

### 8b — `updated_at` em todos os `.update()` do process-chat-flow
21 pontos de atualização no `process-chat-flow/index.ts` agora incluem `updated_at: new Date().toISOString()`, renovando o timestamp a cada interação.

### 8c — pg_cron atualizado
Cron usa `updated_at < now() - INTERVAL '15 minutes'` em vez de `started_at < now() - 3 min`.

---

# FIX 9 ✅ — IA não responde: safety net mata flow em quota error (11/03/2026)

## Problema
O `process-buffered-messages` tratava erros 429/503 (quota/rate limit) como falha fatal, disparando `forceAIExit` e matando o flow antes da IA ter chance de responder.

## Correções aplicadas

### 9a — Distinguir quota error de erro técnico real
Na safety net do `process-buffered-messages`, erros 429/503 com `quota_error` ou `retry_suggested: true` NÃO disparam `forceAIExit`. Buffer fica como `processed=false` para retry no próximo ciclo.

### 9b — Refresh `updated_at` do flow state após buffer processing com sucesso
Após `ai-autopilot-chat` retornar OK via buffer, o `updated_at` do `chat_flow_states` é atualizado para evitar morte prematura pelo cron de 15 min.

### 9c — Anti-retry infinito (3 ciclos)
Buffers que falham por quota por 3+ ciclos de cron (~3 min) enviam mensagem de "alta demanda" ao contato e são marcados como processed.

---

# FIX 10 ✅ — Auditoria IA Semana 1: Quick wins (11/03/2026)

## Correções aplicadas

### 10a — auto-handoff: UUID dinâmico
Substituído UUID hardcoded `36ce66cd-...` por busca dinâmica do departamento "Suporte" via `departments.ilike('name', '%suporte%')`. Se não encontrado, loga warning e aplica handoff sem forçar departamento.

### 10b — auto-handoff: Markdown removido das notas internas
Removido `**bold**` de todas as notas internas (linhas 78, 97, 174-181). Notas agora usam texto plano com emojis para compatibilidade cross-canal (WhatsApp).

### 10c — ai-autopilot-chat: Memória cross-session
Busca últimas 3 conversas fechadas do mesmo contact_id e injeta última mensagem de agente/sistema no system prompt. IA agora lembra conversas anteriores do mesmo cliente.

### 10d — ai-autopilot-chat: Persona contextual
Tom da IA varia automaticamente baseado no status do contato:
- VIP/assinante → tom premium e proativo
- Churn risk/inativo → tom empático e acolhedor
- Lead quente (score ≥ 80) → tom entusiasmado e consultivo

---

# FIX 11 ✅ — Passive Learning ativado + Cron Job (11/03/2026)

## O que foi feito

### 11a — Flag `ai_passive_learning_enabled` = true
Inserido na tabela `system_configurations` com categoria `ai`.

### 11b — Cron job `passive-learning-hourly`
pg_cron agendado para rodar a cada hora (`0 * * * *`), invocando a edge function `passive-learning-cron` via `net.http_post`.

### Estado confirmado
- `ai_global_enabled` = true
- `ai_shadow_mode` = false
- `ai_passive_learning_enabled` = true
