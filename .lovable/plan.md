

# Corrigir Loading Real e hasActiveSearch com Debounce

## Problema 1: Loading sempre false nos filtros dedicados

Na linha 284-288, o `activeLoading` retorna `false` para mine/not_responded/sla porque so o `data` foi desestruturado dos hooks, sem o `isLoading`. Isso faz o usuario ver lista vazia por alguns frames durante o fetch.

## Problema 2: hasActiveSearch sem debounce

Na linha 238, `hasActiveSearch` usa `filters.search` (valor imediato), mas o `useInboxSearch` usa `debouncedSearch` internamente. Isso cria um mismatch de ~300ms onde a UI entra em modo busca mas `searchResults` ainda e `undefined`, mostrando lista vazia.

## Correcoes

### 1. `src/pages/Inbox.tsx` (linhas 119-121) — Guardar objeto completo dos hooks

Antes:
```typescript
const { data: myNotRespondedItems } = useMyNotRespondedInboxItems(...)
const { data: myInboxItems } = useMyInboxItems(...)
const { data: slaExceededItems } = useSlaExceededItems(...)
```

Depois:
```typescript
const myNotRespondedQuery = useMyNotRespondedInboxItems(...)
const myInboxQuery = useMyInboxItems(...)
const slaQuery = useSlaExceededItems(...)
```

### 2. `src/pages/Inbox.tsx` (linha 124) — Importar useDebouncedValue e criar hasActiveSearch correto

Adicionar import de `useDebouncedValue` e derivar `hasActiveSearch` do valor debounced:

```typescript
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
// ...
const debouncedSearch = useDebouncedValue(filters.search || "", 300);
```

### 3. `src/pages/Inbox.tsx` (linha 238) — hasActiveSearch usa debounce

Antes:
```typescript
const hasActiveSearch = !!(filters.search && filters.search.trim().length >= 2);
```

Depois:
```typescript
const hasActiveSearch = debouncedSearch.trim().length >= 2;
```

### 4. `src/pages/Inbox.tsx` (linhas 240-247) — activeItems usa queries completas

Antes:
```typescript
if (isNotResponded) return myNotRespondedItems ?? [];
if (isMine) return myInboxItems ?? [];
if (isSla) return slaExceededItems ?? [];
```

Depois:
```typescript
if (isNotResponded) return myNotRespondedQuery.data ?? [];
if (isMine) return myInboxQuery.data ?? [];
if (isSla) return slaQuery.data ?? [];
```

### 5. `src/pages/Inbox.tsx` (linhas 284-290) — activeLoading com isLoading real

Antes:
```typescript
const activeLoading = hasActiveSearch ? searchLoading :
  isMine ? false :
  isNotResponded ? false :
  isSla ? false :
  inboxLoading;

const isPageLoading = activeLoading || searchLoading;
```

Depois:
```typescript
const activeLoading = hasActiveSearch ? searchLoading :
  isNotResponded ? myNotRespondedQuery.isLoading :
  isMine ? myInboxQuery.isLoading :
  isSla ? slaQuery.isLoading :
  inboxLoading;

const isPageLoading = activeLoading;
```

### 6. (Bonus) Adicionar `general_manager` no human_queue (linha 262)

Antes:
```typescript
if (role === 'admin' || role === 'manager' || role === 'support_manager' || role === 'cs_manager') {
```

Depois:
```typescript
if (role === 'admin' || role === 'manager' || role === 'support_manager' || role === 'cs_manager' || role === 'general_manager') {
```

## Resultado

| Fix | Antes | Depois |
|-----|-------|--------|
| Loading nos filtros | Sempre false (lista vazia por frames) | isLoading real do hook ativo |
| hasActiveSearch | Imediato (mismatch de 300ms) | Sincronizado com debounce do hook |
| isPageLoading | Redundante (activeLoading OR searchLoading) | Limpo (so activeLoading) |
| human_queue ACL | Faltava general_manager | Incluido |

## Arquivos modificados

1. `src/pages/Inbox.tsx` — 6 pontos de ajuste (import, hooks, hasActiveSearch, activeItems, activeLoading, human_queue ACL)

