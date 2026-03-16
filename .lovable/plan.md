

# Auditoria Completa — 2 Bugs Críticos Encontrados

## Bug 1: `route-conversation` — Operador `&&` inválido (ERRO ATIVO NOS LOGS)

**Log exato:**
```
❌ route-conversation error: operator does not exist: uuid && unknown
```

**Causa:** Linha 616 usa `.overlaps('agent_departments.department_id', deptIds)`. O operador `.overlaps()` do Supabase gera SQL `&&` (overlap de arrays), mas `agent_departments.department_id` é uma coluna UUID de uma tabela joinada, NÃO um array. PostgREST não consegue aplicar `&&` entre UUID e array.

**Impacto:** Toda vez que o fluxo faz handoff para humano, o roteamento falha. O agente nunca é atribuído. A conversa fica órfã em `waiting_human` sem `assigned_to`.

**Correção em `supabase/functions/route-conversation/index.ts` (linha 616):**

Substituir `.overlaps()` por filtro via `in()` na tabela joinada:
```typescript
// DE:
agentsQuery = agentsQuery.overlaps('agent_departments.department_id', deptIds);

// PARA:
agentsQuery = agentsQuery.in('agent_departments.department_id', deptIds);
```

O `.in()` funciona em colunas joinadas e filtra corretamente agentes que pertencem a qualquer dos departamentos da hierarquia.

---

## Bug 2: `ai-autopilot-chat` — Retry payload sem `model` (risco de resposta vazia)

**Causa:** O retry (linhas 7271-7275) cria um payload com `messages` e `max_completion_tokens: 300`, mas **não inclui `model`**. Dentro de `callAIWithFallback`, o modelo é adicionado na chamada `tryModel()` via `{ model, ...attemptPayload }`, então isso está OK. 

Porém, o `max_completion_tokens: 300` é muito baixo para gpt-5-mini — frequentemente produz respostas cortadas que aparecem como "vazio". O modelo precisa de pelo menos 500-800 tokens para formular uma resposta contextual.

**Correção em `supabase/functions/ai-autopilot-chat/index.ts` (linha 7273):**
```typescript
// DE:
max_completion_tokens: 300,

// PARA:
max_completion_tokens: 800,
```

---

## Resumo

| # | Arquivo | Linha | Bug | Severidade |
|---|---------|-------|-----|------------|
| 1 | `route-conversation/index.ts` | 616 | `.overlaps()` em coluna UUID joinada | **CRÍTICO** — roteamento quebrado |
| 2 | `ai-autopilot-chat/index.ts` | 7273 | `max_completion_tokens: 300` muito baixo | **ALTO** — respostas vazias no retry |

## Deploy
Deploy individual de `route-conversation` e `ai-autopilot-chat`.

