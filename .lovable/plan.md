
# Corrigir filtro "Agentes" no Relatorio de Tickets

## Problema

O dropdown "Todos Agentes" na pagina `/reports/tickets-export` esta listando **todos os profiles** (incluindo clientes, contatos, etc.) porque a query nao filtra por role interno.

Codigo atual (linha 50-56 de `TicketsExportReport.tsx`):
```typescript
const { data: agents } = useQuery({
  queryKey: ["agents-list"],
  queryFn: async () => {
    const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
    return data ?? [];
  },
});
```

## Solucao

Filtrar apenas usuarios com roles internos (admin, manager, support_agent, etc.), usando um JOIN com `user_roles` — mesmo padrao ja usado em `useUsersByDepartment.tsx`.

## Alteracao

**Arquivo**: `src/pages/TicketsExportReport.tsx` (linhas 50-56)

Substituir a query de agentes por:

```typescript
const INTERNAL_ROLES = [
  'admin', 'general_manager', 'manager', 'sales_rep', 'consultant',
  'support_agent', 'support_manager', 'financial_manager', 'financial_agent',
  'cs_manager', 'ecommerce_analyst'
];

const { data: agents } = useQuery({
  queryKey: ["internal-agents-list"],
  queryFn: async () => {
    // 1. Buscar user_ids com roles internos
    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", INTERNAL_ROLES);

    const ids = roles?.map(r => r.user_id) || [];
    if (ids.length === 0) return [];

    // 2. Buscar profiles apenas desses users
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids)
      .order("full_name");

    return data ?? [];
  },
});
```

## Impacto

- **Zero regressao**: apenas muda quais profiles aparecem no dropdown de filtro
- **Nenhuma tabela/RLS/migration** necessaria
- **Padrao consistente** com `useUsersByDepartment` que ja usa a mesma logica
- O filtro `p_agent_id` enviado para a RPC `get_tickets_export_report` continua funcionando igual
