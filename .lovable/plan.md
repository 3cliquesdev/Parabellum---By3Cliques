

# Fix: Dashboard Financeiro — Widgets ignorando filtro e usando dados errados

## Problema

Três widgets no dashboard Financeiro **não respeitam o filtro de data** e/ou **não usam dados da Kiwify**:

1. **FinancialStatusWidget** ("Arrecadado / Gasto / Saldo") — usa `useFinancialStats()` que puxa dados de `deals` (CRM), não da Kiwify. Mostra "Arrecadado R$ 0,00" porque não há deals com status "won". Deveria mostrar receita real da Kiwify.
2. **LTVWidget** — não recebe `dateRange`, usa `useLTVStats()` sem filtro de data.
3. **ConversionRateWidget** — usa `daysBack=90` fixo em vez do `dateRange` do dashboard.

Os 4 KPIs do topo, TopAffiliates, FinancialKPIs e RevenueBreakdown já usam `useKiwifyFinancials` corretamente.

## Correção

### 1. Substituir FinancialStatusWidget por dados Kiwify

Refatorar `FinancialStatusWidget` para receber `startDate/endDate` e usar `useKiwifyFinancials` em vez de `useFinancialStats`:
- **Arrecadado** → `totalGrossRevenue` (receita bruta Kiwify)
- **Gasto** → `totalKiwifyFees + totalAffiliateCommissions` (custos reais: taxas + comissões)
- **Saldo** → `totalNetRevenue` (receita líquida = o que sobra)

### 2. Passar dateRange para LTVWidget

Atualizar `LTVWidget` para aceitar `startDate/endDate` → propagar para `useLTVStats`.
Atualizar `useLTVStats` para filtrar deals por `closed_at` dentro do período.

### 3. Passar dateRange para ConversionRateWidget

Substituir `daysBack` por `startDate/endDate` → propagar para `useConversionStats`.
Atualizar `useConversionStats` para usar o período em vez de `daysBack`.

### 4. Atualizar FinancialDashboardTab

Passar `dateRange.from/to` para todos os widgets que ainda não recebem.

## Arquivos

- `src/components/widgets/FinancialStatusWidget.tsx` — refatorar para Kiwify
- `src/components/widgets/LTVWidget.tsx` — adicionar props de data
- `src/hooks/useLTVStats.tsx` — adicionar filtro por data
- `src/components/widgets/ConversionRateWidget.tsx` — trocar daysBack por dateRange
- `src/hooks/useConversionStats.tsx` — aceitar dateRange
- `src/components/dashboard/FinancialDashboardTab.tsx` — passar dateRange a todos

