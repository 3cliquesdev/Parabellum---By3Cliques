

# Enterprise Performance - Fase 2: Completar otimizacoes pendentes

## Estado atual (ja implementado)

Os seguintes itens ja foram entregues na fase anterior:

- `src/lib/prefetch.ts` -- usePrefetchOnHover + usePerformanceLog (OK)
- `src/lib/select-fields.ts` -- TICKET_SELECT centralizado (OK)
- `src/hooks/useTicketById.tsx` -- select minimo + abortSignal + staleTime (OK)
- `src/pages/TicketDetail.tsx` -- render-first com skeleton (OK)
- `src/hooks/useSupportMetrics.tsx` -- usando RPC consolidada (OK)
- `src/components/dashboard/OverviewDashboardTab.tsx` -- usando RPC counts (OK)
- Migration SQL -- RPCs criadas (OK)

## Pendencias identificadas (escopo desta entrega)

### 1. useDeals.tsx ainda usa select(*)

A query principal ainda faz `select(*, contacts(...), ...)`. Precisa trocar por DEAL_SELECT centralizado.

**Arquivo:** `src/lib/select-fields.ts`
- Adicionar constante `DEAL_SELECT` com campos minimos para kanban/listagem

**Arquivo:** `src/hooks/useDeals.tsx`
- Substituir `select(\`*,contacts(...)\`)` por `select(DEAL_SELECT)`
- Adicionar `abortSignal(signal)` via `queryFn: async ({ signal })`

### 2. useActiveTicketStatuses sem staleTime

Statuses de ticket mudam rarissimamente mas o hook refaz a query a cada mount.

**Arquivo:** `src/hooks/useTicketStatuses.tsx`
- Adicionar `staleTime: 10 * 60 * 1000` (10 min) no `useActiveTicketStatuses`

### 3. TicketDetails.tsx carrega TODOS os usuarios (useUsers) no mount

`useUsers()` traz todos os usuarios do sistema na abertura de cada ticket. Isso e um fan-out desnecessario. A lista so e usada para popular o Select de "Atribuido a".

**Arquivo:** `src/components/TicketDetails.tsx`
- Manter useUsers() mas com `staleTime` longo (5 min) para evitar refetch por ticket
- O assigned_user ja vem do join do ticket, entao o display nao depende de useUsers

### 4. Prefetch em TicketsList (hover nos itens)

Ao passar o mouse num ticket da lista, pre-carregar os dados daquele ticket.

**Arquivo:** `src/components/TicketsList.tsx`
- Importar `usePrefetchOnHover` e `TICKET_SELECT`
- No item da lista, criar um wrapper com handlers de prefetch para `useTicketById`

### 5. usePerformanceLog faltando em Deals e Dashboard

Ja esta no TicketDetail. Precisa adicionar nas outras rotas.

**Arquivos:**
- Pagina de Deals (identificar arquivo da rota `/deals`)
- `src/components/dashboard/OverviewDashboardTab.tsx` -- adicionar perf log

---

## Detalhes tecnicos

### DEAL_SELECT (novo em select-fields.ts)

```typescript
export const DEAL_SELECT = `
  id, title, value, status, stage_id, pipeline_id, contact_id,
  organization_id, assigned_to, probability, expected_close_date,
  created_at, updated_at, closed_at, lost_reason, lead_source,
  contacts(id, first_name, last_name, email, phone, company),
  organizations(name),
  assigned_user:profiles!deals_assigned_to_fkey(id, full_name, avatar_url)
`;
```

### useDeals.tsx -- mudanca cirurgica

```typescript
// ANTES
.select(`
  *,
  contacts (id, first_name, last_name, email, phone, company),
  organizations (name),
  assigned_user:profiles!deals_assigned_to_fkey (id, full_name, avatar_url)
`)

// DEPOIS
import { DEAL_SELECT } from "@/lib/select-fields";
// ...
queryFn: async ({ signal }) => {
  let query = supabase.from("deals").select(DEAL_SELECT);
  // ... filtros iguais ...
  const { data, error } = await query.abortSignal(signal);
```

### useActiveTicketStatuses -- staleTime

```typescript
export function useActiveTicketStatuses() {
  return useQuery({
    queryKey: ["ticket-statuses", "active"],
    queryFn: async (): Promise<TicketStatus[]> => { /* igual */ },
    staleTime: 10 * 60 * 1000, // 10min - raramente muda
  });
}
```

### TicketsList.tsx -- prefetch no hover

Cada item da lista ganha handlers de prefetch. Ao hover 150ms, pre-carrega o ticket. Clique subsequente e instantaneo (cache hit).

### TicketDetails.tsx -- staleTime em useUsers

```typescript
// useUsers ja tem staleTime: 2min no hook. Suficiente.
// Apenas garantir que nao refetch desnecessario.
```

---

## Arquivos modificados

| Arquivo | Tipo | Mudanca |
|---|---|---|
| `src/lib/select-fields.ts` | EDIT | Adicionar DEAL_SELECT |
| `src/hooks/useDeals.tsx` | EDIT | Trocar select(*) por DEAL_SELECT + abortSignal |
| `src/hooks/useTicketStatuses.tsx` | EDIT | staleTime 10min em useActiveTicketStatuses |
| `src/components/TicketsList.tsx` | EDIT | Prefetch no hover dos itens |
| `src/components/dashboard/OverviewDashboardTab.tsx` | EDIT | usePerformanceLog |

## Impacto

- **Zero regressao**: nenhum campo usado no render e removido do DEAL_SELECT
- **Deals payload**: reduzido ~40% (sem description, metadata, campos nao usados no kanban)
- **Ticket statuses**: 1 fetch a cada 10min em vez de a cada mount
- **Prefetch tickets**: hover na lista pre-carrega dados, click e instantaneo
- **Rollback**: cada arquivo e independente

