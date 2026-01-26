
## Plano: Correção do Problema de Conversas Perdidas ao Atualizar Página

### Diagnóstico Detalhado

Identifiquei **3 problemas principais** que causam a perda de conversas ao atualizar a página:

---

### Problema 1: Resubscrição Excessiva do Realtime

Os logs do console mostram um ciclo vicioso:

```text
[Realtime] Removing inbox_view channel
[Realtime] inbox_view subscription status: CLOSED
[Realtime] Setting up inbox_view subscription with incremental merge...
[Realtime] inbox_view subscription status: SUBSCRIBED
[Realtime] Running catch-up from cursor: 2026-01-26T11:38:52
(... repete 10+ vezes em 2 segundos ...)
```

**Causa**: O useEffect em `useInboxView.tsx` (linha 308) tem dependências instáveis:

```typescript
useEffect(() => {
  // ...canal realtime...
}, [queryClient, user?.id, role, departmentIds, filters, fetchOptions]);
//                                             ↑           ↑
//                                             Objetos que mudam a cada render!
```

- `filters` é um objeto novo a cada render (comparação por referência falha)
- `fetchOptions` é recriado via `useMemo` mas com deps que mudam
- Isso recria o canal realtime repetidamente, causando perda de conexão

---

### Problema 2: Cache não Persistido

Ao dar refresh na página:
1. O React Query limpa todo o cache
2. O `lastSeenRef` é resetado para `null`
3. Uma nova query busca apenas os últimos 200 registros
4. Conversas mais antigas "desaparecem" temporariamente

**Impacto**: Usuários perdem acesso a conversas abertas que não estão nos 200 mais recentes.

---

### Problema 3: Múltiplos Canais Conflitantes

A página de Inbox cria **5+ canais realtime simultâneos**:

| Canal | Hook | Tabela |
|-------|------|--------|
| `inbox-view-realtime` | useInboxView | inbox_view |
| `inbox-badge-updates` | useMyPendingCounts | inbox_view |
| `conversations-realtime-v2` | useConversations | conversations |
| `messages-realtime-{id}` | useMessages | messages |
| `user-notifications` | RealtimeNotifications | messages, conversations, etc |

Cada canal tem suas próprias dependências e pode invalidar queries uns dos outros, causando:
- Refetches desnecessários
- Perda de dados do cache
- Overhead de conexão

---

### Solução Proposta

#### Fase 1: Estabilizar Dependências do useEffect

**Arquivo**: `src/hooks/useInboxView.tsx`

```typescript
// ANTES (problemático)
useEffect(() => {
  // ...
}, [queryClient, user?.id, role, departmentIds, filters, fetchOptions]);

// DEPOIS (estável)
// Usar useRef para valores que não precisam recriar o canal
const stableFilters = useRef(filters);
stableFilters.current = filters;

useEffect(() => {
  // ...usar stableFilters.current...
}, [user?.id]); // Apenas recriar canal quando usuário muda
```

#### Fase 2: Unificar Canais Realtime

Criar um único canal consolidado para o inbox que lida com todas as tabelas:

```typescript
// src/hooks/useInboxRealtime.tsx (NOVO)
const channel = supabase.channel("inbox-consolidated")
  .on("postgres_changes", { event: "*", table: "inbox_view" }, handleInboxChange)
  .on("postgres_changes", { event: "*", table: "conversations" }, handleConversationChange)
  .subscribe();
```

#### Fase 3: Aumentar Limite e Adicionar Paginação

**Arquivo**: `src/hooks/useInboxView.tsx`

```typescript
// ANTES
.limit(200)

// DEPOIS: Buscar mais registros inicialmente + paginação sob demanda
.limit(500) // ou implementar infinite scroll
```

#### Fase 4: Persistir Cache Crítico (Opcional)

Usar `persistQueryClient` do TanStack Query para manter dados entre refreshes:

```typescript
import { persistQueryClient } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

persistQueryClient({
  queryClient,
  persister,
  maxAge: 1000 * 60 * 5, // 5 minutos
});
```

---

### Arquivos a Modificar

1. **`src/hooks/useInboxView.tsx`**
   - Estabilizar dependências do useEffect
   - Remover `filters` e `fetchOptions` das deps do realtime
   - Usar refs para valores que não precisam recriar canal

2. **`src/hooks/useConversations.tsx`**
   - Remover `filters` das deps do useEffect
   - Usar ref estável para filtros

3. **`src/hooks/useMessages.tsx`**
   - Remover invalidação de `["inbox-view"]` (já atualizado via realtime próprio)

4. **`src/pages/Inbox.tsx`** (opcional)
   - Memoizar objeto `filters` com useMemo

---

### Resultado Esperado

- Canais realtime permanecem estáveis (sem reconexões constantes)
- Dados permanecem no cache durante navegação
- Refresh da página carrega dados rapidamente
- Menos overhead de rede e banco de dados
- Conversas não "desaparecem" ao atualizar

---

### Ordem de Implementação

1. Corrigir dependências do useEffect (impacto imediato)
2. Remover invalidações cruzadas entre hooks
3. Testar estabilidade do realtime
4. Avaliar necessidade de persistência de cache
