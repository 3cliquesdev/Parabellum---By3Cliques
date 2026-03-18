

# Auditoria V14: Atendentes Não Veem Conversas da IA

## Causa Raiz Identificada

Existem **3 camadas de filtragem** que restringem visibilidade, e **2 delas** estão incorretas para a fila de IA:

### Bug 24 (CRITICO): RLS do `inbox_view` Falta Cláusula de Fila IA Global

A tabela `conversations` tem a policy `canonical_select_conversations` com esta cláusula que permite a TODOS os roles internos ver conversas autopilot/waiting_human não atribuídas, independente de departamento:

```sql
OR ((ai_mode = ANY (ARRAY['autopilot', 'waiting_human']))
    AND (status <> 'closed')
    AND (assigned_to IS NULL)
    AND has_any_role(auth.uid(), ARRAY['admin', 'manager', ..., 'support_agent', 'consultant', ...]))
```

Porém a tabela `inbox_view` (que alimenta toda a lista do Inbox) tem apenas a policy `optimized_inbox_select` que **NÃO tem esta cláusula**. Resultado: agentes de departamentos diferentes de "Suporte" não recebem nenhum dado do banco para conversas autopilot no departamento Suporte.

### Bug 25 (CRITICO): Client-side filter no `useInboxView` restringe por departamento

Mesmo que o RLS fosse corrigido, o código em `useInboxView.tsx` (L272-286) aplica filtro adicional por `departmentIds`:

```typescript
if (role === "sales_rep" || role === "support_agent" || role === "financial_agent") {
  query = query.or(
    `assigned_to.eq.${userId},department.in.(${departmentIds.join(",")}),and(assigned_to.is.null,department.is.null)`
  );
}
```

Isso exclui conversas autopilot de departamentos diferentes do agente.

### Bug 26 (MODERADO): `get-inbox-counts` `applyVisibility` também restringe

A edge function `get-inbox-counts` usa `applyVisibility()` que aplica a mesma restrição departamental. O badge "Fila IA" mostra 0 mesmo havendo 8 conversas autopilot ativas.

## Dados Confirmados

| Dado | Valor |
|---|---|
| Conversas autopilot ativas (conversations) | 7 |
| Conversas autopilot no inbox_view | 8 |
| Departamento das conversas | Suporte (36ce66cd-...) |
| assigned_to | NULL (todas) |
| Policy inbox_view | `optimized_inbox_select` (SEM cláusula AI global) |
| Policy conversations | `canonical_select_conversations` (COM cláusula AI global) |

---

## Plano de Correção

### 1. Bug 24 — Adicionar cláusula AI queue global na RLS do `inbox_view`

Criar uma migration SQL para adicionar a cláusula que espelha a `canonical_select_conversations`:

```sql
DROP POLICY IF EXISTS optimized_inbox_select ON public.inbox_view;

CREATE POLICY optimized_inbox_select ON public.inbox_view
FOR SELECT TO authenticated
USING (
  -- Full access roles
  has_any_role(auth.uid(), ARRAY['admin','manager','general_manager',
    'support_manager','cs_manager','financial_manager']::app_role[])
  -- Assigned to me
  OR (assigned_to = auth.uid())
  -- My department (open, unassigned or same dept)
  OR (
    has_any_role(auth.uid(), ARRAY['sales_rep','support_agent',
      'financial_agent','consultant']::app_role[])
    AND (
      (department = (SELECT profiles.department FROM profiles WHERE profiles.id = auth.uid()))
      OR (assigned_to IS NULL AND department IS NULL)
    )
  )
  -- ✅ NEW: AI queue global visibility (autopilot/waiting_human, unassigned)
  OR (
    ai_mode IN ('autopilot', 'waiting_human')
    AND status != 'closed'
    AND assigned_to IS NULL
    AND has_any_role(auth.uid(), ARRAY['admin','manager','general_manager',
      'support_manager','cs_manager','financial_manager','sales_rep',
      'support_agent','financial_agent','consultant']::app_role[])
  )
);
```

### 2. Bug 25 — Remover restrição departamental para fila IA no client-side

No `useInboxView.tsx` (`fetchInboxData`), não aplicar filtro de departamento quando a conversa é autopilot/waiting_human sem atribuição. Alternativa mais simples: para roles operacionais, expandir o `.or()` para incluir conversas autopilot:

```typescript
if (role === "sales_rep" || role === "support_agent" || role === "financial_agent") {
  if (departmentIds && departmentIds.length > 0) {
    query = query.or(
      `assigned_to.eq.${userId},department.in.(${departmentIds.join(",")}),and(assigned_to.is.null,department.is.null),and(ai_mode.eq.autopilot,assigned_to.is.null),and(ai_mode.eq.waiting_human,assigned_to.is.null)`
    );
  } else {
    query = query.or(
      `assigned_to.eq.${userId},and(assigned_to.is.null,department.is.null),and(ai_mode.eq.autopilot,assigned_to.is.null),and(ai_mode.eq.waiting_human,assigned_to.is.null)`
    );
  }
}
```

Aplicar a mesma lógica nos blocos de chunked queries (L217-231).

### 3. Bug 26 — Corrigir `applyVisibility` no `get-inbox-counts`

Na edge function `get-inbox-counts/index.ts`, expandir a função `applyVisibility` para incluir a fila IA:

```typescript
if (role === "sales_rep" || role === "support_agent" || role === "financial_agent") {
  if (userDepartmentId) {
    return query.or(
      `assigned_to.eq.${userId},department.eq.${userDepartmentId},and(assigned_to.is.null,department.is.null),and(ai_mode.eq.autopilot,assigned_to.is.null),and(ai_mode.eq.waiting_human,assigned_to.is.null)`
    );
  }
  return query.or(
    `assigned_to.eq.${userId},and(assigned_to.is.null,department.is.null),and(ai_mode.eq.autopilot,assigned_to.is.null),and(ai_mode.eq.waiting_human,assigned_to.is.null)`
  );
}
```

### 4. Realtime visibility — atualizar shouldShow no listener

No listener realtime do `useInboxView.tsx` (L568), adicionar condição para AI queue:

```typescript
const isAIQueueGlobal = 
  row.assigned_to === null && 
  (row.ai_mode === 'autopilot' || row.ai_mode === 'waiting_human') &&
  row.status !== 'closed';

const shouldShow = hasFullAccess || 
  isAssignedToMe || 
  isUnassignedAllowed ||
  isAssignedToColleagueInMyDept ||
  isAIQueueGlobal;  // ✅ NEW
```

### Resumo de Arquivos Alterados

1. **Migration SQL** — Nova policy RLS no `inbox_view`
2. **`src/hooks/useInboxView.tsx`** — Expandir `.or()` + realtime shouldShow
3. **`supabase/functions/get-inbox-counts/index.ts`** — Expandir `applyVisibility`

