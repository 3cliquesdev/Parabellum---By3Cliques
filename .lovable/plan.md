
# Plano: Correção COMPLETA das Policies de inbox_view

## Diagnóstico Confirmado

A migration anterior **NÃO removeu** as 8 policies antigas de `inbox_view` que usam `has_role()`:

| Policy existente | Status |
|-----------------|--------|
| `optimized_inbox_select` | ✅ Criada (correta) |
| `cs_manager_view_inbox` | ❌ NÃO removida |
| `financial_agent_view_inbox` | ❌ NÃO removida |
| `financial_manager_view_inbox` | ❌ NÃO removida |
| `general_manager_view_inbox` | ❌ NÃO removida |
| `sales_rep_view_sales_inbox` | ❌ NÃO removida |
| `support_agent_view_assigned_inbox` | ❌ NÃO removida |
| `support_manager_view_inbox` | ❌ NÃO removida |
| `user_view_department_inbox` | ❌ NÃO removida |

## Impacto

1. **Performance**: 9 policies sendo avaliadas com OR (has_role executado múltiplas vezes)
2. **Visibilidade**: Pode haver conflitos entre a nova policy e as antigas
3. **Admin sem acesso**: O Postgres pode estar atingindo timeout antes de completar a avaliação

## Solução

### Fase 1: SQL Migration - Limpeza COMPLETA de inbox_view

```sql
-- Remover TODAS as policies SELECT antigas de inbox_view
DROP POLICY IF EXISTS cs_manager_view_inbox ON public.inbox_view;
DROP POLICY IF EXISTS financial_agent_view_inbox ON public.inbox_view;
DROP POLICY IF EXISTS financial_manager_view_inbox ON public.inbox_view;
DROP POLICY IF EXISTS general_manager_view_inbox ON public.inbox_view;
DROP POLICY IF EXISTS sales_rep_view_sales_inbox ON public.inbox_view;
DROP POLICY IF EXISTS support_agent_view_assigned_inbox ON public.inbox_view;
DROP POLICY IF EXISTS support_manager_view_inbox ON public.inbox_view;
DROP POLICY IF EXISTS user_view_department_inbox ON public.inbox_view;

-- A policy optimized_inbox_select JÁ EXISTE e é a correta
-- Verificar se precisa adicionar regras para agentes verem 
-- conversas não atribuídas do seu departamento
```

### Fase 2: Verificar se optimized_inbox_select cobre todos os casos

A policy atual permite:
- Managers (admin, manager, etc.): acesso TOTAL ✅
- Qualquer usuário: ver conversas assigned_to = auth.uid() ✅

**FALTANDO**:
- Sales_rep ver conversas unassigned do departamento Comercial
- Support_agent ver conversas unassigned do departamento Suporte
- Financial_agent ver conversas unassigned do departamento Financeiro

Se isso for necessário, a policy precisa ser expandida.

### Fase 3: Recriar optimized_inbox_select com cobertura completa

```sql
DROP POLICY IF EXISTS optimized_inbox_select ON public.inbox_view;
CREATE POLICY optimized_inbox_select
ON public.inbox_view
FOR SELECT
TO authenticated
USING (
  -- Managers: acesso total
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin','manager','general_manager',
        'support_manager','cs_manager','financial_manager'
      )
  )
  OR
  -- Assigned to me: sempre vejo minhas conversas
  (assigned_to = auth.uid())
  OR
  -- Agentes: ver conversas do mesmo departamento (atribuídas ou não)
  (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('sales_rep','support_agent','financial_agent','consultant')
    )
    AND (
      -- Meu departamento
      department = (SELECT department FROM profiles WHERE id = auth.uid())
      OR
      -- Ou unassigned sem departamento (pool geral)
      (assigned_to IS NULL AND department IS NULL)
    )
  )
);
```

## Resultado Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Policies SELECT em inbox_view | 9 | 1 |
| has_role() calls | O(n) por query | 0 |
| Visibilidade Admin | ❌ Inconsistente | ✅ Total |
| Performance | Timeout | <500ms |

## Rollback (se necessário)

```sql
-- Recriar policies antigas se algo der errado
CREATE POLICY cs_manager_view_inbox ON public.inbox_view
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cs_manager'::app_role));
-- ... outras
```

## Seção Técnica

### Por que o Admin não vê conversas

Com 9 policies avaliadas em OR, e várias usando `has_role()` que faz subquery para cada linha:
1. Postgres tenta avaliar todas as 9 condições
2. Para cada linha (3216 na view), executa has_role() 8 vezes
3. Total: ~25.000 chamadas de função por query
4. Resultado: timeout antes de retornar dados

A nova policy `optimized_inbox_select` seria suficiente sozinha, mas as antigas continuam sendo avaliadas em paralelo.
