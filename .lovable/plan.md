
# Corrigir visualizacao de conversas encerradas no Inbox

## Problema encontrado

A query que busca conversas encerradas usa `order("updated_at", ascending: true)` com `limit(500)`. Isso retorna as **500 conversas mais antigas** (de 10/02) em vez das **mais recentes** (de hoje). Com 7.293 conversas fechadas no banco, o usuario nunca ve as que acabou de encerrar.

Para conversas ativas, `ascending: true` faz sentido (mais antigas = maior prioridade de atendimento). Mas para encerradas, o usuario espera ver as mais recentes primeiro.

## Correcao

### Arquivo: `src/hooks/useInboxView.tsx`

**Mudanca na funcao `fetchInboxData` (linhas 82-84):**

Usar ordem descendente para scope `archived` (mais recentes primeiro) e aumentar o limite para 1000:

```typescript
// Antes:
query = query
  .order("updated_at", { ascending: true })
  .limit(500);

// Depois:
const isArchived = scope === 'archived';
query = query
  .order("updated_at", { ascending: !isArchived })
  .limit(isArchived ? 1000 : 500);
```

**Mudanca na funcao `sortInboxItemsByPriority` (linhas 251-255):**

Manter consistencia: conversas encerradas devem ser exibidas com as mais recentes no topo da lista. O sort no `filteredData` ja e aplicado pelo `useMemo` usando `applyFilters`, mas o `ConversationList` recebe os dados na ordem que vem. Precisamos ajustar a ordenacao no `filteredConversations` do `Inbox.tsx`.

### Arquivo: `src/pages/Inbox.tsx`

**Mudanca na ordenacao (funcao `orderedConversations`):**

Para o filtro `archived`, inverter a ordem para que as encerradas mais recentes aparecam primeiro:

```typescript
// No useMemo de orderedConversations, adicionar logica:
if (filter === "archived") {
  result.sort((a, b) => 
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
  );
}
```

## Impacto

| Item | Status |
|------|--------|
| Conversas ativas | Sem mudanca (ascending = true mantido) |
| Conversas encerradas | Agora mostra as 1000 mais recentes, ordenadas da mais nova para a mais antiga |
| Realtime/cache | Sem impacto (merge continua funcionando normalmente) |
| Performance | Minimo (1000 vs 500 rows para archived apenas) |

## Zero regressao

- Kill Switch, Shadow Mode, CSAT guard: sem impacto
- Filtros ativos (Minhas, Fila IA, etc.): sem mudanca
- Cache realtime: merge e scope continuam identicos
