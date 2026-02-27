

# Fix: Busca de ticket #622 não aparece para gerentes/admins

## Diagnóstico

O problema está no `getHookParams()` em `Support.tsx`. Quando o sidebar está em filtros como `my_open`, `unassigned`, ou um status dinâmico, a busca textual funciona **apenas dentro do subconjunto filtrado pelo sidebar**. Ou seja:

- Admin com sidebar em "Meus abertos" → busca "622" → query adiciona `assigned_to = user.id` → ticket #622 não aparece porque está atribuído a outro agente
- Isso contradiz a regra existente (memória do projeto): **"ticket search is global across all statuses"** — mas a globalidade se aplica apenas a status, não a assignment/sidebar

## Causa raiz

`getHookParams()` (linhas 183-235 de `Support.tsx`) aplica `assignedFilter` (mine, unassigned, created_by_me) **mesmo quando há busca ativa**. O bypass só acontece para status (linhas 218-221).

## Solução

**Arquivo: `src/pages/Support.tsx`** — função `getHookParams()`

Quando há busca ativa (`debouncedFilters.search` não vazio), ignorar o sidebar completamente e retornar apenas os filtros avançados sem `assignedFilter` e sem status default:

```typescript
const getHookParams = () => {
  const baseFilters: TicketFilters = {
    ...debouncedFilters,
    search: debouncedFilters.search || searchTerm,
  };

  // BUSCA GLOBAL: quando há termo de busca, ignorar sidebar
  const hasActiveSearch = !!(baseFilters.search && baseFilters.search.trim().length > 0);
  if (hasActiveSearch) {
    return { advancedFilters: baseFilters }; // Sem assignedFilter, sem status default
  }

  // ... resto da lógica existente do switch (sidebarFilter) inalterada
};
```

Isso garante que:
- Busca por "622" sempre encontra o ticket, independente do sidebar ativo
- Sem busca, o sidebar continua funcionando normalmente
- Zero regressão nos filtros existentes

## Impacto
- Apenas o caminho com busca ativa muda (bypass do sidebar)
- Sidebar sem busca: comportamento idêntico ao atual
- Rollback: reverter 5 linhas em `getHookParams()`

