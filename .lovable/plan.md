

# FIX Enterprise: Filtros do Inbox Instantaneos e Consistentes

## Problema Confirmado no Codigo

Apos leitura completa de `useInboxView.tsx` (684 linhas) e `Inbox.tsx` (655 linhas):

1. **Linha 286**: `queryKey` inclui `filtersKey` (JSON.stringify dos filtros) - qualquer mudanca de filtro dispara refetch completo ao banco
2. **Linha 309**: `applyFilters()` roda dentro do `queryFn` - cache ja nasce filtrado, realtime nao re-filtra
3. **Linhas 381-382, 424-425, 571, 593**: realtime, catch-up, visibility e resetUnread usam `filtersKeyRef` na queryKey do `setQueryData`
4. **Bug oculto do Archived**: `fetchInboxData` faz `.neq("status", "closed")` (linha 71), mas `Inbox.tsx` linha 290 tenta filtrar `status === "closed"` - arquivadas NUNCA aparecem no cache atual

## Solucao: 2 Caches Brutos + Filtro via useMemo

```text
ANTES:
  queryKey = [inbox-view, userId, role, deptKey, filtersKey]
  queryFn  = fetch() -> applyFilters() -> cache FILTRADO
  realtime = merge SEM filtro -> inconsistencia

DEPOIS:
  queryKey = [inbox-view, userId, role, deptKey, scopeKey]
  queryFn  = fetch() -> cache BRUTO (sem applyFilters)
  useMemo  = applyFilters(rawData, filters) -> instantaneo
  realtime = merge no cache bruto -> useMemo re-filtra automaticamente
```

## Arquivo: `src/hooks/useInboxView.tsx`

### 1. Adicionar parametro `scope` ao hook

```typescript
export function useInboxView(filters?: InboxFilters, scope: 'active' | 'archived' = 'active')
```

### 2. Remover `filtersKey` e `filtersKeyRef`

- Remover linhas 263-266 (`filtersKey = useMemo(...)`)
- Remover linhas 271-272 (`filtersKeyRef`)
- Substituir por `scopeKey = scope`

### 3. Alterar `queryKey` (linha 286)

De: `[...QUERY_KEY, user?.id, role, deptKey, filtersKey]`
Para: `[...QUERY_KEY, user?.id, role, deptKey, scope]`

### 4. Alterar `fetchInboxData` para aceitar scope

- `scope = "active"`: manter `.neq("status", "closed")` (como hoje)
- `scope = "archived"`: usar `.eq("status", "closed")` (fix do bug)

### 5. Remover `applyFilters` do `queryFn` (linhas 296-309)

De:
```typescript
// tag lookup + applyFilters inside queryFn
return applyFilters(result, filters);
```
Para:
```typescript
return result; // cache bruto
```

### 6. Adicionar `useMemo` para filtragem instantanea

Apos a query, antes do return:
```typescript
// Tag lookup separado (async -> proprio hook/query)
const tagIdsSet = useTagConversationIds(filters?.tagId);

const filteredData = useMemo(
  () => applyFilters(query.data ?? [], filters, tagIdsSet),
  [query.data, filters, tagIdsSet]
);
```

### 7. Criar mini-hook `useTagConversationIds`

Para resolver o lookup async de tags sem poluir o queryFn:
```typescript
function useTagConversationIds(tagId?: string): Set<string> | undefined {
  const { data } = useQuery({
    queryKey: ['tag-conversation-ids', tagId],
    queryFn: async () => {
      const { data } = await supabase
        .from('conversation_tags')
        .select('conversation_id')
        .eq('tag_id', tagId!);
      return new Set(data?.map(t => t.conversation_id) || []);
    },
    enabled: !!tagId,
    staleTime: 30000,
  });
  return data;
}
```

### 8. Atualizar `applyFilters` para aceitar `tagIdsSet`

Adicionar parametro opcional `tagIdsSet?: Set<string>` e filtrar por ele em vez do lookup async.

### 9. Atualizar TODAS as chamadas `setQueryData` no realtime

Substituir `filtersKeyRef.current` por `scope` (ou ref do scope) em:
- Linha 382 (inbox_view realtime)
- Linha 425 (catch-up)
- Linha 571 (visibility change)
- Linha 593 (resetUnreadCount)

Para realtime de `messages` e `conversations` (linhas 456, 527): ja usam `setQueriesData` com `exact: false` - esses ficam OK.

### 10. Retorno do hook

```typescript
return {
  ...query,
  data: filteredData,    // dados filtrados (para UI)
  rawData: query.data,   // dados brutos (para debug/referencia)
  resetUnreadCount,
};
```

## Arquivo: `src/pages/Inbox.tsx` (minimo)

### 1. Passar `scope` para o hook

```typescript
const isArchived = filter === "archived";
const scope = isArchived ? 'archived' : 'active';
const { data: inboxItems, isLoading: inboxLoading } = useInboxView(inboxViewFilters, scope);
```

### 2. Remover filtro redundante no `filteredConversations`

No `case "archived"` (linha 290): como o cache ja vem com scope correto, nao precisa re-filtrar `status === "closed"`.

## Resumo de Impacto

| Acao | Antes | Depois |
|------|-------|--------|
| Mudar filtro (status/canal/etc) | Refetch ao banco (1-3s) | Instantaneo (useMemo, 0ms) |
| Realtime + filtro ativo | Item "fura" filtro | useMemo re-filtra automaticamente |
| Trocar active/archived | Nao funcionava (bug) | 2 caches separados, correto |
| Tag filter | Async dentro queryFn | Hook separado + useMemo |

## Arquivos Modificados

1. `src/hooks/useInboxView.tsx` - Refatoracao principal (queryKey, queryFn, useMemo, realtime, scope)
2. `src/pages/Inbox.tsx` - Passar `scope` ao hook (1 linha)

## Zero Regressao

- Mesma logica de `applyFilters`, so muda ONDE roda
- Realtime continua funcionando (merge no cache bruto)
- Hooks dedicados (mine, not_responded, sla) nao sao afetados
- Contagens (useInboxCounts) nao sao afetadas

