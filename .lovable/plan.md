

# Fix: Dashboard Suporte -- filtros de data nos KPIs

## Problema Identificado

Os KPIs do dashboard de suporte (SLA em Risco, Tickets Abertos, Conversas) filtram por `created_at` dentro do período selecionado. Quando o usuário seleciona "Hoje", só aparecem tickets/conversas **criados hoje** que ainda estão abertos -- não o total real de itens abertos.

Exemplo real:
- **Tickets abertos totais:** 97
- **"Este Mês" mostra:** 80 (criados em fev que ainda estão abertos)
- **"Hoje" mostra:** 4 (criados hoje que ainda estão abertos)
- **O usuário espera ver:** 97 em qualquer filtro (todos os tickets abertos agora)

Os gráficos (Volume vs Resolução, SLA Compliance) devem usar o filtro de data normalmente. Apenas os KPIs de "estado atual" precisam mostrar valores absolutos.

## Solução

### 1. Atualizar RPC `get_support_dashboard_counts`

Separar KPIs em dois grupos:
- **KPIs operacionais (sem filtro de data):** tickets_open, conversations_open, sla_risk -- representam o estado ATUAL
- **KPIs de período (com filtro):** conversations_closed, tickets_created_period, conversations_created_period

```sql
-- tickets_open: ALL open tickets (no date filter)
SELECT COUNT(*) INTO v_tickets_open
FROM tickets
WHERE status NOT IN ('resolved', 'closed');

-- conversations_open: ALL open conversations (no date filter)  
SELECT COUNT(*) INTO v_conversations_open
FROM conversations
WHERE status NOT IN ('closed', 'resolved');

-- sla_risk: ALL tickets currently at risk (no date filter)
SELECT COUNT(*) INTO v_sla_risk
FROM tickets
WHERE due_date IS NOT NULL
  AND due_date < now()
  AND status NOT IN ('resolved', 'closed');

-- conversations_closed: closed IN PERIOD (keep date filter)
SELECT COUNT(*) INTO v_conversations_closed
FROM conversations
WHERE closed_at >= p_start AND closed_at < p_end;
```

### 2. Passar datas para `SentimentDistributionWidget`

No `SupportDashboardTab.tsx`, passar `startDate` e `endDate` para `SentimentDistributionWidget` que já aceita esses props mas não os recebe.

### 3. Sem alteração nos gráficos

`VolumeResolutionWidget`, `SLAComplianceWidget`, `TopTagsWidget`, `TopTopicsWidget` continuam filtrando por período normalmente -- isso é o comportamento correto para gráficos de tendência.

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Recriar `get_support_dashboard_counts` com KPIs operacionais sem filtro de data |
| `src/components/dashboard/SupportDashboardTab.tsx` | Passar `startDate`/`endDate` para `SentimentDistributionWidget` |

