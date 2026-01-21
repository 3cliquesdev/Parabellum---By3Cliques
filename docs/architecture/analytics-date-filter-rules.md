# Regras de Filtro de Data - Analytics Dashboard

> **DOCUMENTO TRAVADO** - Validado em 21/01/2026
> 
> NÃO ALTERAR estas regras sem validação completa com baseline de 15/01/2026

---

## 1. Regra Padrão Definitiva

| Métrica | Campo de Filtro | Justificativa |
|---------|-----------------|---------------|
| **Deals Criados** | `created_at` | Mede quando o deal nasceu no período |
| **Deals Ganhos** | `closed_at` | Mede quando foi convertido no período |
| **Deals Perdidos** | `closed_at` | Mede quando foi finalizado no período |
| **Deals Abertos** | `created_at` | Mede deals nascidos ainda em aberto |

---

## 2. Hooks Auditados - Regra Padrão

Todos os hooks abaixo seguem a regra padrão (created_at para criados, closed_at para ganhos/perdidos):

| Hook | Arquivo | Criados | Ganhos | Perdidos | Status |
|------|---------|---------|--------|----------|--------|
| `useDealsCounts` | `src/hooks/useDealsCounts.tsx` | `created_at` | `closed_at` | `closed_at` | ✅ |
| `useWonDealsByChannel` | `src/hooks/useWonDealsByChannel.tsx` | - | `closed_at` | - | ✅ |
| `useDealsMetrics` | `src/hooks/useDealsMetrics.tsx` | `created_at` | `closed_at` | `closed_at` | ✅ |
| `useDashboardMetrics` | `src/hooks/useDashboardMetrics.tsx` | `created_at` | `closed_at` | `closed_at` | ✅ |
| `useLeadCreationMetrics` | `src/hooks/useLeadCreationMetrics.tsx` | `created_at` | `closed_at` | `closed_at` | ✅ |
| `useSalesByRep` | `src/hooks/useSalesByRep.tsx` | - | `closed_at` | - | ✅ |
| `useTopPerformers` | `src/hooks/useTopPerformers.tsx` | - | `closed_at` | - | ✅ |
| `useRevenueTimeline` | `src/hooks/useRevenueTimeline.tsx` | - | `closed_at` | - | ✅ |
| `useGoalProgress` | `src/hooks/useGoalProgress.tsx` | - | `closed_at` | - | ✅ |
| `useMonthlyWonDeals` | `src/hooks/useMonthlyWonDeals.tsx` | - | `closed_at` | - | ✅ |
| `useLeadsBySource` | `src/hooks/useLeadsBySource.tsx` | `created_at` | - | - | ✅ |
| `usePipelineValue` | `src/hooks/usePipelineValue.tsx` | `created_at` | - | - | ✅ |

---

## 3. Hooks com Lógica Especial (Funil de Conversão)

Estes hooks usam `created_at` para TODOS os status para garantir que o funil some 100%:

| Hook | Arquivo | Regra | Justificativa |
|------|---------|-------|---------------|
| `useDealsConversionAnalysis` | `src/hooks/useDealsConversionAnalysis.tsx` | `created_at` para TODOS | Funil: Won + Lost + Open = Created (100%) |
| `useAllSourcesConversionAnalysis` | `src/hooks/useAllSourcesConversionAnalysis.tsx` | `created_at` para TODOS | Mesma lógica de funil por fonte |

**Nota:** Esta lógica é intencional e documentada nos arquivos com comentário `⚠️ LÓGICA TRAVADA`.

---

## 4. Kiwify Events

| Métrica | Campo de Filtro | Tabela |
|---------|-----------------|--------|
| Vendas Brutas | `payload.approved_date` | `kiwify_events` |
| Reembolsos | `payload.approved_date` | `kiwify_events` |
| Receita Líquida | `payload.approved_date` | `kiwify_events` |

---

## 5. Baseline de Validação (15/01/2026)

Use estes valores para validar qualquer alteração nos hooks:

| Métrica | Valor Esperado | Hook Principal |
|---------|----------------|----------------|
| Deals Criados | **306** | `useDealsCounts` |
| Deals Ganhos | **240** | `useDealsCounts` |
| Deals Abertos | **64** | `useDealsCounts` |
| Vendas Kiwify | **210** | `useKiwifyCompleteMetrics` |

---

## 6. Utilitários de Data

Todos os hooks devem usar:

```typescript
import { getDateTimeBoundaries, formatLocalDate } from "@/lib/dateUtils";

// Gera boundaries consistentes: T00:00:00 a T23:59:59
const { startDateTime, endDateTime } = getDateTimeBoundaries(startDate, endDate);
```

---

## 7. Checklist para Novos Hooks

Ao criar um novo hook de métricas:

- [ ] Identificar se a métrica é de "nascimento" (created_at) ou "fechamento" (closed_at)
- [ ] Usar `getDateTimeBoundaries` para consistência
- [ ] Testar com baseline de 15/01/2026
- [ ] Adicionar a esta documentação
- [ ] Incluir comentário `⚠️ LÓGICA TRAVADA` se for regra especial

---

## 8. Histórico de Alterações

| Data | Alteração | Responsável |
|------|-----------|-------------|
| 20/01/2026 | Criação inicial e validação | Sistema |
| 21/01/2026 | Auditoria completa de 16 hooks | Sistema |
| 21/01/2026 | Regra de atribuição: Comercial = assigned_to | Ver sales-channel-attribution-rules.md |
