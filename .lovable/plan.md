

# Fix: Filtro de Data nas Encerradas não retorna resultados

## Problema

Mesmo problema do filtro "Somente IA": o filtro de **dateRange** é aplicado **client-side** sobre os 1000 registros mais recentes. Se a data selecionada (ex: 10/03/2026) não cai dentro dessas 1000 conversas, o resultado é zero.

## Correção

Passar o `dateRange` para a função `fetchInboxData` e aplicar `.gte()` / `.lte()` na query do banco **antes** do `.limit()`, apenas para o scope `archived`.

### Alterações em `src/hooks/useInboxView.tsx`:

1. **`FetchOptions`** (linha 59-66): Adicionar campo `dateRange?: DateRange`.

2. **`fetchInboxData`** (linhas 68-123): Quando `scope === 'archived'` e `dateRange` estiver definido, aplicar filtro no campo `last_message_at`:
   - `dateRange.from` → `.gte("last_message_at", startOfDay)`
   - `dateRange.to` → `.lte("last_message_at", endOfDay)`

3. **`fetchOptions` memo** (linha 309-315): Incluir `filters?.dateRange` quando `scope === 'archived'`.

4. **`queryKey`** (linha 322): Adicionar as datas (formatadas) à key para disparar refetch ao mudar período.

## Resultado

Filtro de período nas encerradas trará até 1000 conversas **daquele período específico**, em vez de filtrar client-side sobre um recorte que pode não conter a data selecionada.

