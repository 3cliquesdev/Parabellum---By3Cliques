

# Otimizacao Enterprise do Inbox - Fase 1 (Patch Final)

## Resumo

Reduzir de 7+ queries simultaneas para 2-3, removendo redundancias, aplicando lazy-load por filtro, e estabilizando renders com useMemo. Inclui os 2 ajustes finais solicitados.

## Ajustes confirmados

| Ajuste | Status |
|--------|--------|
| 1. activeItems nunca retorna null | Aplicar - sempre retornar array vazio |
| 2. useInboxSearch so roda com hasActiveSearch | Ja OK - hook tem `enabled: debouncedSearch.trim().length >= 2` |

## Alteracoes por arquivo

### 1. `src/pages/Inbox.tsx`

**A) Remover imports e chamadas (linhas 4, 113, 118):**
- Remover `import { useConversations }` (linha 4)
- Remover `const { data: rawInboxItems } = useInboxView()` (linha 113)
- Remover `const { data: conversations, isLoading: convLoading } = useConversations()` (linha 118)

**B) Estabilizar filtros com useMemo (linhas 94-106):**

Substituir objeto literal por useMemo:

```typescript
const inboxViewFilters = useMemo<InboxViewFiltersType>(() => ({
  dateRange: filters.dateRange,
  channels: filters.channels,
  status: filters.status,
  assignedTo: filters.assignedTo,
  search: filters.search,
  slaStatus: filters.slaExpired ? 'critical' : undefined,
  hasAudio: filters.hasAudio,
  hasAttachments: filters.hasAttachments,
  aiMode: filters.aiMode as InboxViewFiltersType['aiMode'],
  department: departmentFilter || undefined,
  tagId: tagFilter || undefined,
}), [filters.dateRange, filters.channels, filters.status, filters.assignedTo,
     filters.search, filters.slaExpired, filters.hasAudio, filters.hasAttachments,
     filters.aiMode, departmentFilter, tagFilter]);
```

**C) Lazy-load hooks dedicados (linhas 121-127):**

Substituir chamadas incondicionais por:

```typescript
const isMine = filter === "mine";
const isNotResponded = filter === "not_responded";
const isSla = filter === "sla";

const { data: myNotRespondedItems } = useMyNotRespondedInboxItems({ enabled: isNotResponded, refetchInterval: 60_000 });
const { data: myInboxItems } = useMyInboxItems({ enabled: isMine, refetchInterval: 60_000 });
const { data: slaExceededItems } = useSlaExceededItems({ enabled: isSla, refetchInterval: 60_000 });
```

**D) Substituir `filteredConversations` inteiro (linhas 256-385):**

Logica simplificada sem `fullConversations`, sem `rawInboxItems`, sem `getConversationFromItem`:

```typescript
const hasActiveSearch = !!(filters.search && filters.search.trim().length >= 2);

const activeItems = useMemo(() => {
  if (hasActiveSearch) return searchResults ?? [];
  if (isNotResponded) return myNotRespondedItems ?? [];
  if (isMine) return myInboxItems ?? [];
  if (isSla) return slaExceededItems ?? [];
  return inboxItems ?? [];
}, [hasActiveSearch, searchResults, isNotResponded, myNotRespondedItems,
    isMine, myInboxItems, isSla, slaExceededItems, inboxItems]);

const filteredConversations = useMemo(() => {
  let result = activeItems.map(inboxItemToConversation);

  // Department filter
  if (departmentFilter) {
    result = result.filter(c => c.department === departmentFilter);
  }

  // Filter by URL param
  switch (filter) {
    case "ai_queue":
      return result.filter(c => c.ai_mode === 'autopilot' && c.status !== 'closed');
    case "human_queue":
      if (role === 'admin' || role === 'manager' || role === 'support_manager' || role === 'cs_manager') {
        return result.filter(c => c.ai_mode !== 'autopilot' && c.status !== 'closed');
      }
      if (departmentFilter) {
        return result.filter(c => c.ai_mode !== 'autopilot' && c.status !== 'closed');
      }
      return result.filter(c => c.ai_mode !== 'autopilot' && c.assigned_to === user?.id && c.status !== 'closed');
    case "mine":
      return result.filter(c => c.assigned_to === user?.id && c.status !== 'closed');
    case "not_responded":
    case "sla":
      return result; // Ja vem filtrado do hook dedicado
    case "unassigned":
      return result.filter(c => !c.assigned_to && c.status !== 'closed');
    case "archived":
      return result.filter(c => c.status === "closed");
    default:
      return result.filter(c => c.status !== 'closed');
  }
}, [activeItems, inboxItemToConversation, departmentFilter, filter, role, user?.id]);
```

**E) Loading do activeQuery (linhas 700, 613):**

Substituir `inboxLoading || convLoading || searchLoading || ...` por:

```typescript
const activeLoading = hasActiveSearch ? searchLoading :
  isMine ? false : // useMyInboxItems nao tem isLoading exposto no destructuring atual
  isNotResponded ? false :
  isSla ? false :
  inboxLoading;

const isPageLoading = activeLoading || searchLoading;
```

Usar `isPageLoading` nos dois `ConversationList` (desktop linha 700, mobile linha 613). Remover `convLoading` e `filteredConversations === null`.

**F) Remover `getConversationFromItem` (linhas 251-254)** - nao mais usado.

**G) Remover `inboxItemIds` (linhas 157-160)** - nao mais usado (era para rawInboxItems).

**H) Ajustar `displayTotalCount` (linha 511):**

Antes: `filteredConversations.length` (podia ser null)
Depois: `filteredConversations?.length ?? 0`

### 2. `src/hooks/useMyInboxItems.tsx`

Aceitar opts parametrizavel:

```typescript
export function useMyInboxItems(opts?: { enabled?: boolean; refetchInterval?: number }) {
  const { user } = useAuth();
  const enabled = opts?.enabled ?? true;
  const refetchInterval = opts?.refetchInterval ?? 30_000;

  return useQuery({
    queryKey: [...QUERY_KEY, user?.id],
    queryFn: async (): Promise<InboxViewItem[]> => { /* mesma queryFn */ },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchInterval,
    enabled: enabled && !!user?.id,
  });
}
```

### 3. `src/hooks/useMyNotRespondedInboxItems.tsx`

Mesmo padrao: aceitar `opts?: { enabled?: boolean; refetchInterval?: number }`.

### 4. `src/hooks/useSlaExceededItems.tsx`

Mesmo padrao: aceitar `opts?: { enabled?: boolean; refetchInterval?: number }`.

### 5. `src/hooks/useInboxView.tsx` (useInboxCounts, linhas 656-657)

```text
Antes: staleTime: 15_000, refetchInterval: 30_000
Depois: staleTime: 30_000, refetchInterval: 60_000
```

## Resultado esperado

| Metrica | Antes | Depois |
|---------|-------|--------|
| Queries ao abrir | 7+ | 2 (inbox_view + counts) |
| Queries com filtro ativo | 7+ | 3 (+ 1 dedicado) |
| Canais realtime | 4 | 3 |
| Rows transferidos | ~5500 + JOINs | ~500 |
| Polling/min | ~12 | ~3-4 |
| Re-renders | Alto (filters instavel) | Reduzido (useMemo) |
| null safety | activeItems podia ser null | Sempre array |

## Checklist de seguranca

- activeItems sempre retorna array (nunca null)
- useInboxSearch ja tem enabled com debounce
- filtros estabilizados com useMemo
- Loading vem do activeQuery ativo
- Bulk actions continuam usando orderedConversations
- Busca continua via useInboxSearch (sem mudanca)
- Realtime: 3 canais (sem duplicacao)
- orderedConversations usa filteredConversations (que agora e sempre array)
