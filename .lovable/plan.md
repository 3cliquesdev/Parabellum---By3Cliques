

# Fix: Restaurar filtro de data nos KPIs do Dashboard Suporte

## Problema

A correção anterior removeu os filtros de data dos KPIs operacionais (SLA em Risco, Tickets Abertos, Conversas) no RPC `get_support_dashboard_counts`. Agora esses valores ficam fixos (97, 50, 28) independente de selecionar "Hoje", "Ontem" ou qualquer período. O usuário quer que todos os KPIs respeitem o filtro de data selecionado.

## Evidência

Screenshots mostram:
- Hoje: SLA=28, Tickets=97, Conversas=50 
- Ontem: SLA=28, Tickets=97, Conversas=50
- Valores idênticos = filtro não está sendo aplicado

## Solução (1 migration)

Recriar `get_support_dashboard_counts` restaurando filtros `created_at >= p_start AND created_at < p_end` em todas as queries:

- `tickets_open`: tickets criados no período que ainda estão abertos
- `conversations_open`: conversas criadas no período que ainda estão abertas
- `sla_risk`: tickets criados no período com SLA estourado
- `conversations_closed`: conversas fechadas no período (já estava correto)

| Arquivo | Ação |
|---|---|
| Migration SQL | `CREATE OR REPLACE FUNCTION get_support_dashboard_counts` com filtros de data restaurados |

Nenhuma alteração de frontend necessária. Ambas as telas (Dashboard aba Suporte e Dashboard Suporte V2) serão corrigidas.

