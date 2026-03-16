

# Adicionar filtro de Departamento no Inbox

## O que será feito

Adicionar um **Select de Departamento** dentro do popover de "Filtros Avançados" do Inbox, permitindo filtrar conversas por departamento diretamente na interface de filtros.

## Alterações

### 1. `src/components/inbox/InboxFilterPopover.tsx`
- Adicionar `departmentId?: string` à interface `InboxFilters`
- Importar `useDepartments` 
- Adicionar Select de departamento no popover (entre "Modo IA" e "Atribuído a")
- Incluir `departmentId` no `clearFilters`
- Contar `departmentId` no `activeFiltersCount`

### 2. `src/pages/Inbox.tsx`
- No `inboxViewFilters` (linha 114), priorizar `filters.departmentId` sobre `departmentFilter` da URL:
  ```
  department: filters.departmentId || departmentFilter || undefined
  ```
- Adicionar `filters.departmentId` ao array de dependências do `useMemo`
- Adicionar `departmentId: undefined` no `DEFAULT_FILTERS`

### 3. `src/components/inbox/ActiveFilterChips.tsx`
- Importar `useDepartments`
- Adicionar chip para `departmentId` mostrando nome do departamento com bolinha colorida

### Sem alterações no backend
O `useInboxView` já suporta filtro por `department` — apenas precisa receber o valor do filtro.

