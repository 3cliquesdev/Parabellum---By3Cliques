

# Fix: Thundering Herd Residual no `get-inbox-counts`

## Problema

Os logs mostram 14+ boots simultâneos da função. O cache e promise coalescing atuais são **per-isolate** — cada cold start cria um isolate novo com cache vazio, anulando a proteção. Além disso, o cálculo interno faz **12+ queries ao banco** incluindo N queries sequenciais (uma por departamento).

## Correções (2 frentes)

### 1. Frontend — Reduzir rajadas de requests (`src/hooks/useInboxView.tsx`)

- **Aumentar dedupe** de 2.5s → 5s (`INBOX_COUNTS_DEDUPE_MS`)
- **Adicionar jitter** ao `refetchInterval` (55-65s em vez de fixo 60s) para desalinhar tabs/usuários
- **`refetchOnMount: false`** para evitar refetch ao navegar entre páginas

### 2. Backend — Reduzir custo de cada invocação (`supabase/functions/get-inbox-counts/index.ts`)

- **Consolidar `byDepartment`**: trocar N queries sequenciais por UMA query agrupada:
  ```sql
  SELECT department, count(*) FROM conversations 
  WHERE status != 'closed' GROUP BY department
  ```
- **Consolidar `byTag`**: trocar 2 queries (buscar IDs + buscar tags) por uma única com group by
- **Aumentar cache TTL** de 6s → 10s — reduz cache misses em 40%
- **Mover auth + role para paralelo**: executar `getUser` e buscar role em `Promise.all` ao invés de sequencial

### 3. Deploy da função

Resultado esperado: ~60% menos invocações da função e cada invocação ~3x mais rápida (de ~12 queries para ~6).

