

# Auditoria RLS — Resultado e Limpeza de Policies Legadas

## Estado atual (pós-migration anterior)

A migration anterior **já aplicou corretamente** as policies `is_manager_or_admin` nas 5 tabelas. Porém, a auditoria revelou **2 policies legadas redundantes** que devem ser removidas para evitar confusão:

| Tabela | Policy legada | Tipo | Problema |
|--------|--------------|------|----------|
| `departments` | `managers_can_update_departments` | UPDATE | Usa `has_role` individual (4 roles hardcoded), redundante com `managers_can_manage_departments` FOR ALL |
| `sales_goals` | `managers_can_view_goals` | SELECT | Só checa `manager` e `admin`, ignora outros gerentes. Redundante com `managers_can_manage_goals` FOR ALL |

As policies FOR ALL já cobrem SELECT, INSERT, UPDATE e DELETE — então essas duas legadas são puro ruído e potencialmente confusas.

## Plano

Uma migration simples com 2 DROP:

```sql
DROP POLICY IF EXISTS "managers_can_update_departments" ON public.departments;
DROP POLICY IF EXISTS "managers_can_view_goals" ON public.sales_goals;
```

## Resultado final (todas as 5 tabelas limpas)

- **products**: `managers_can_manage_products` FOR ALL ✅
- **departments**: `managers_can_manage_departments` FOR ALL ✅ (sem a legada UPDATE)
- **sales_goals**: `managers_can_manage_goals` FOR ALL ✅ (sem a legada SELECT)
- **goal_milestones**: `managers_can_manage_milestones` FOR ALL ✅
- **ai_response_cache**: `managers_delete` + `managers_insert` ✅

Nenhuma alteração de código. Zero impacto funcional — as policies removidas são subconjuntos das que já existem.

