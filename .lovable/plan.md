

# Auditoria Completa: Inbox, IA, ChatFlow — 3 Bugs Encontrados

## Bug 1: `route-conversation` — Join filter não filtra agentes por departamento (CRÍTICO — ATIVO)

**Evidência nos logs (20:33:20):**
```text
found_count: 0, error: undefined
department_filter: "Suporte Sistema", parent_department exists, sibling_departments: 1
```

O erro `uuid && unknown` foi corrigido (deploy propagou), mas agora `found_count: 0` mesmo com agentes online. O `.in('agent_departments.department_id', deptIds)` em um **embedded resource** do PostgREST **não filtra os registros pais** — ele apenas filtra quais rows da tabela `agent_departments` são retornadas no embed, sem excluir perfis que não tenham match.

**Correção:** Trocar o embed de `agent_departments(department_id)` para `agent_departments!inner(department_id)`. O `!inner` força um INNER JOIN, fazendo com que apenas perfis com pelo menos um `department_id` correspondente sejam retornados.

**Arquivo:** `supabase/functions/route-conversation/index.ts`
- **Linha 593:** `agent_departments(department_id)` → `agent_departments!inner(department_id)`

---

## Bug 2: `ai-autopilot-chat` — `max_tokens: 10` na classificação de intenção (ALTO)

**Causa:** Linha 4369 envia `max_tokens: 10` para classificar "skip" vs "search". O `callAIWithFallback` converte para `max_completion_tokens: 10`. Em modelos reasoning (`gpt-5-mini`), os tokens de raciocínio interno contam contra esse limite — 10 tokens é insuficiente e frequentemente retorna vazio ou truncado, fazendo o intent cair em `search` (fallback), o que gasta tokens desnecessariamente em saudações.

**Correção:** Aumentar para `max_completion_tokens: 50` (suficiente para "skip" ou "search" + reasoning overhead).

**Arquivo:** `supabase/functions/ai-autopilot-chat/index.ts`
- **Linha 4369:** `max_tokens: 10` → `max_completion_tokens: 50`

---

## Bug 3: `ai-autopilot-chat` — Payload principal com `temperature` + `max_tokens` (MÉDIO)

**Causa:** Linha 7005-7006 monta o aiPayload com `temperature` e `max_tokens`. O `callAIWithFallback` converte `max_tokens` → `max_completion_tokens` e remove `temperature` no `tryModel`, então **funciona corretamente**. Porém, se `persona.max_tokens` é `null`, o default `500` é baixo para respostas complexas com reasoning models.

**Status:** Funcionando mas subótimo. Não é bug bloqueante — o `tryModel` já normaliza. Apenas recomendação de aumentar o default para `800`.

---

## Resumo de Ações

| # | Arquivo | Linha | Bug | Severidade | Ação |
|---|---------|-------|-----|------------|------|
| 1 | `route-conversation/index.ts` | 593 | Join sem `!inner` não filtra agentes | **CRÍTICO** | Adicionar `!inner` |
| 2 | `ai-autopilot-chat/index.ts` | 4369 | `max_tokens: 10` insuficiente para reasoning | **ALTO** | Aumentar para 50 |
| 3 | `ai-autopilot-chat/index.ts` | 7006 | Default `max_tokens: 500` baixo | **MÉDIO** | Aumentar para 800 |

## Demais Componentes Auditados (OK)

- **ContextMemoryAgent.ts:** Usa `gpt-4o-mini` fixo para compressão — correto, sem risco.
- **`callAIWithFallback`:** Normalização de `temperature`/`max_tokens` para reasoning models — correto.
- **`meta-whatsapp-webhook`:** Campo `department` correto (fix anterior aplicado).
- **`handle-whatsapp-event`:** Campo `department` correto, sem referências a `department_id` na coluna de conversations.
- **`process-chat-flow`:** Fluxo de menus funcionando corretamente (logs confirmam navegação ok).
- **Retry logic (linha 7271-7275):** `max_completion_tokens: 800` e sem duplicação — correto.
- **Fallback inteligente (linha 7333-7343):** Prioriza `flowFallbackMessage` → `flowObjective` → genérico — correto.

## Deploy
Deploy de `route-conversation` e `ai-autopilot-chat`.

