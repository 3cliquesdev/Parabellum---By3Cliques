

# Fix: KPI "Conversas" deve mostrar total do período

## Problema

O card "CONVERSAS" mostra apenas conversas **abertas** criadas no período (~47-50). O usuário espera ver o **total de conversas** no período (abertas + fechadas). Esta semana o total real é ~1378.

## Solução (1 migration)

Atualizar `get_support_dashboard_counts` para retornar dois campos de conversas:
- `conversations_total`: todas as conversas criadas no período (abertas + fechadas)
- `conversations_closed`: conversas fechadas no período (já existe)

E ajustar o frontend para mostrar o total no card principal, com "X encerradas" como subtexto.

### 1. Migration: Atualizar RPC

```sql
-- conversations_total: ALL conversations created in period
SELECT COUNT(*) INTO v_conversations_total
FROM conversations
WHERE created_at >= p_start AND created_at < p_end;

-- Remove v_conversations_open, replace with v_conversations_total in return
```

### 2. Frontend: `SupportDashboardTab.tsx`

Alterar o card "Conversas" para usar `conversations_total` em vez de `conversations_open`:
```tsx
value={(counts?.conversations_total || 0).toString()}
```

## Arquivos

| Arquivo | Ação |
|---|---|
| Migration SQL | Trocar `conversations_open` por `conversations_total` no RPC |
| `SupportDashboardTab.tsx` | Usar `conversations_total` no card |
| `useSupportMetrics.tsx` | Atualizar interface `SupportDashboardCounts` |

