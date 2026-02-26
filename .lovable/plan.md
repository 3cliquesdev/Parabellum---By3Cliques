

# Fix Dashboard Suporte: Métricas corretas + Filtros funcionando

## Problemas identificados

1. **FRT incorreto**: Mede `first_response_at - created_at` (criação da conversa → primeira resposta). Deveria medir: **roteamento ao departamento → agente humano responder** (usando `conversation_assignment_logs.created_at` → primeira mensagem do agente)
2. **MTTR incorreto**: Mede `closed_at - created_at` (vida inteira da conversa). Deveria medir: **agente assume → encerramento** (usando `assigned_to` set → `closed_at`)
3. **Filtros não funcionam**: `useSLAAlerts()` e `useTicketCounts()` NÃO recebem `dateRange` — sempre mostram dados "atuais" independente do filtro
4. **Falta conversas**: KPIs mostram apenas tickets, mas deveria incluir conversas também

## Plano de implementação

### 1. Nova migration SQL — Corrigir RPCs de métricas

Recriar `get_support_metrics_consolidated` com cálculos corretos:

- **FRT** = AVG(primeira mensagem humana `sender_type='user' AND is_bot_message=false` após assignment — `conversation_assignment_logs.created_at`)
  - Usa `conversation_assignment_logs` para pegar `MIN(created_at)` como momento do roteamento
  - Usa `messages` para pegar primeira mensagem do agente humano após assignment
- **Tempo médio atendimento** = AVG(`closed_at` — momento que agente assumiu via assignment_logs)
- **CSAT** = AVG de `conversation_ratings` (já está correto)

Criar nova RPC `get_support_dashboard_counts` que recebe `p_start`/`p_end` e retorna:
- Tickets abertos no período
- Conversas abertas no período
- SLA em risco no período

### 2. Atualizar `useSupportMetrics` hook

- Renomear métricas: `avgFRT` → tempo de espera do agente, `avgMTTR` → tempo médio de atendimento humano
- Manter interface compatível

### 3. Atualizar `SupportDashboardTab` — KPIs com filtro

- KPI "SLA em Risco": passar `startDate/endDate` para filtrar por período
- KPI "Tickets Abertos": usar contagem filtrada por período  
- Adicionar KPI "Conversas" para mostrar volume de conversas no período
- Todos os valores devem reagir à mudança do `dateRange`

### 4. Atualizar `OverviewDashboardTab` — mesmos fixes

- Passar `startDate/endDate` para as métricas de suporte que hoje são estáticas
- Garantir que todos os KPIs de suporte usem o dateRange

### 5. Atualizar `SupportKPIsWidget`

- Ajustar labels: "Tempo de 1ª Resposta (FRT)" → "Tempo até Resposta Humana"
- "Tempo Médio Resolução (MTTR)" → "Tempo Médio de Atendimento"

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Nova migration SQL | Recriar RPCs com cálculos corretos |
| `src/hooks/useSupportMetrics.tsx` | Consumir nova RPC |
| `src/components/dashboard/SupportDashboardTab.tsx` | KPIs filtrados por dateRange |
| `src/components/dashboard/OverviewDashboardTab.tsx` | KPIs filtrados por dateRange |
| `src/components/widgets/SupportKPIsWidget.tsx` | Labels corretos |

## Governança

- Zero regressão: RPCs existentes são substituídas via `CREATE OR REPLACE`
- Hooks mantêm mesma interface (`avgFRT`, `avgMTTR`, `avgCSAT`) — apenas o cálculo muda
- `queryKey` já inclui datas → React Query refetch automático ao mudar filtro

