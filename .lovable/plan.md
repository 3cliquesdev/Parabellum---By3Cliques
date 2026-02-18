

## Correcao: Filtro de Data do Dashboard de Playbooks

### Problema

Ao selecionar um periodo (ex: 17/02/2026 - 17/02/2026), o frontend envia para as RPCs:

```
p_start: "2026-02-17T03:00:00.000Z"
p_end:   "2026-02-17T03:00:00.000Z"
```

Ambos sao a mesma hora exata (meia-noite local convertida para UTC). O intervalo tem largura zero, entao nenhum dado e retornado.

O mesmo problema afeta:
- `usePlaybookMetrics` (KPIs + funil)
- `useEmailEvolutionData` (grafico de evolucao)

### Causa Raiz

Os hooks usam `dateRange.from.toISOString()` e `dateRange.to.toISOString()` diretamente. O `react-day-picker` retorna datas com hora 00:00:00 local. O `toISOString()` converte para UTC (ex: -3h no Brasil), e o `p_end` precisa cobrir ate o final do dia, nao o inicio.

### Solucao

Usar os utilitarios locais ja existentes em `src/lib/dateUtils.ts` (`getStartOfDayString` e `getEndOfDayString`) para:

- `p_start` = `YYYY-MM-DDT00:00:00` (inicio do dia local)
- `p_end` = `YYYY-MM-DDT23:59:59` (final do dia local)

### Arquivos Alterados

**1. `src/hooks/usePlaybookMetrics.tsx`**

Importar `getStartOfDayString` e `getEndOfDayString` de `@/lib/dateUtils`. Substituir todas as ocorrencias de `dateRange.from.toISOString()` por `getStartOfDayString(dateRange.from)` e `dateRange.to.toISOString()` por `getEndOfDayString(dateRange.to)`.

Locais afetados:
- Linha 47-48: parametros da RPC `get_playbook_kpis`
- Linha 68: parametros da RPC `get_playbook_performance`
- Linhas 86, 91: filtros do funil (salesQuery, sentQuery)
- Linhas 105-112: filtros de delivered/opened/clicked

**2. `src/hooks/useEmailTrackingEvents.tsx`**

Mesma correcao nas linhas 114-115: substituir `.toISOString()` por `getStartOfDayString`/`getEndOfDayString`.

### Impacto

- Zero impacto em funcionalidades existentes
- Sem filtro (dateRange undefined): comportamento inalterado
- Com filtro: agora retorna dados do dia completo em vez de intervalo vazio
- Kill Switch, Shadow Mode, CSAT, distribuicao nao sao afetados

