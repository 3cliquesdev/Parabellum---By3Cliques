
# Fix: Dashboard de Playbooks com Dados Reais

## Problema Identificado

O dashboard mostra dados incorretos por 3 razoes:

1. **Fonte de dados errada**: Os hooks `usePlaybookMetrics`, `useEmailFunnelData` e `useEmailEvolutionData` leem da tabela `email_tracking_events`, que contem **apenas eventos `sent`** (6805 registros, todos do tipo `sent`). Os dados reais de abertura e clique estao na tabela `email_sends` (1212 enviados, 607 abertos, 199 clicados).

2. **Limite de 1000 rows do Supabase**: O hook `usePlaybookMetrics` busca TODAS as execucoes sem paginacao, mas existem 3818 execucoes. O Supabase retorna no maximo 1000, truncando os dados.

3. **Tabela Performance por Playbook**: Mostra 0% de abertura porque cruza `email_tracking_events` (so tem `sent`) com execucoes.

### Dados Reais no Banco

| Metrica | Valor Real | Valor no Dashboard |
|---------|-----------|-------------------|
| Emails enviados | 1212 | ~1000 (truncado) |
| Abertos | 607 (50.1%) | 0 |
| Clicados | 199 (16.4%) | 0 |
| Execucoes totais | 3818 | ~1000 (truncado) |
| Completas | 1708 | parcial |

## Solucao

Reescrever os 3 hooks para usar `email_sends` como fonte de verdade e usar queries de contagem (`count: 'exact'`) em vez de buscar todos os registros.

### 1. Reescrever `usePlaybookMetrics.tsx`

Trocar de "buscar tudo e contar no JS" para queries de contagem no banco:

```text
Antes: supabase.from("playbook_executions").select("*") // 3818 rows, truncado em 1000
Depois: 
  - supabase.from("playbook_executions").select("id", { count: "exact", head: true }) // contagem
  - supabase.from("email_sends").select(...) // dados reais de email
```

Queries especificas:
- Contagem total de execucoes: `count: exact, head: true`
- Contagem por status (running/completed/failed): filtros individuais com count
- Metricas de email: `email_sends` com contagem de `opened_at IS NOT NULL`, `clicked_at IS NOT NULL`
- Performance por playbook: query agrupada via RPC ou query otimizada

### 2. Reescrever `useEmailFunnelData` em `useEmailTrackingEvents.tsx`

```text
Antes: busca email_tracking_events.event_type (so tem "sent")
Depois: busca email_sends com contagem de sent_at, opened_at, clicked_at, bounced_at
```

Resultado esperado do funil:
- Enviados: 1212
- Entregues: 1212 (sent sem bounce)
- Abertos: 607
- Clicados: 199

### 3. Reescrever `useEmailEvolutionData` em `useEmailTrackingEvents.tsx`

```text
Antes: busca email_tracking_events agrupando por dia (so tem "sent")
Depois: busca email_sends agrupando por date_trunc('day', sent_at)
         com COUNT(*) as sent, COUNT(opened_at) as opened, COUNT(clicked_at) as clicked
```

Isso precisa de uma RPC no banco (porque nao da pra agrupar por dia via SDK REST):

```sql
CREATE OR REPLACE FUNCTION get_email_evolution(p_days int DEFAULT 7)
RETURNS TABLE(day date, sent bigint, delivered bigint, opened bigint, clicked bigint)
LANGUAGE sql STABLE AS $$
  SELECT 
    date_trunc('day', sent_at)::date as day,
    COUNT(*) as sent,
    COUNT(CASE WHEN bounced_at IS NULL THEN 1 END) as delivered,
    COUNT(opened_at) as opened,
    COUNT(clicked_at) as clicked
  FROM email_sends
  WHERE sent_at >= CURRENT_DATE - p_days
  GROUP BY day
  ORDER BY day
$$;
```

### 4. RPC para Performance por Playbook

Para evitar o problema de limite e calcular no banco:

```sql
CREATE OR REPLACE FUNCTION get_playbook_performance()
RETURNS TABLE(
  playbook_id uuid, playbook_name text,
  executions bigint, completed bigint, failed bigint,
  emails_sent bigint, emails_opened bigint, open_rate numeric
)
LANGUAGE sql STABLE AS $$
  SELECT 
    pe.playbook_id,
    COALESCE(op.name, 'Desconhecido') as playbook_name,
    COUNT(DISTINCT pe.id) as executions,
    COUNT(DISTINCT CASE WHEN pe.status LIKE '%completed%' THEN pe.id END) as completed,
    COUNT(DISTINCT CASE WHEN pe.status = 'failed' THEN pe.id END) as failed,
    COUNT(es.id) as emails_sent,
    COUNT(es.opened_at) as emails_opened,
    CASE WHEN COUNT(es.id) > 0 
      THEN ROUND((COUNT(es.opened_at)::numeric / COUNT(es.id)) * 100, 1) 
      ELSE 0 END as open_rate
  FROM playbook_executions pe
  LEFT JOIN onboarding_playbooks op ON op.id = pe.playbook_id
  LEFT JOIN email_sends es ON es.playbook_execution_id = pe.id
  GROUP BY pe.playbook_id, op.name
  ORDER BY executions DESC
$$;
```

### 5. RPC para KPIs consolidados

```sql
CREATE OR REPLACE FUNCTION get_playbook_kpis()
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'totalExecutions', (SELECT COUNT(*) FROM playbook_executions),
    'running', (SELECT COUNT(*) FROM playbook_executions WHERE status = 'running'),
    'completed', (SELECT COUNT(*) FROM playbook_executions WHERE status LIKE '%completed%'),
    'failed', (SELECT COUNT(*) FROM playbook_executions WHERE status = 'failed'),
    'emails', jsonb_build_object(
      'sent', (SELECT COUNT(*) FROM email_sends),
      'delivered', (SELECT COUNT(*) FROM email_sends WHERE bounced_at IS NULL),
      'opened', (SELECT COUNT(*) FROM email_sends WHERE opened_at IS NOT NULL),
      'clicked', (SELECT COUNT(*) FROM email_sends WHERE clicked_at IS NOT NULL),
      'bounced', (SELECT COUNT(*) FROM email_sends WHERE bounced_at IS NOT NULL)
    )
  )
$$;
```

## Arquivos Modificados

1. **Nova migracao SQL**: Criar RPCs `get_playbook_kpis`, `get_email_evolution`, `get_playbook_performance`
2. **`src/hooks/usePlaybookMetrics.tsx`**: Reescrever para usar RPCs em vez de fetch-all
3. **`src/hooks/useEmailTrackingEvents.tsx`**: Reescrever `useEmailFunnelData` e `useEmailEvolutionData` para usar `email_sends` / RPCs
4. **`src/components/playbooks/PlaybookMetricsDashboard.tsx`**: Sem mudanca (ja consome o hook corretamente)
5. **`src/components/playbooks/EmailEvolutionChart.tsx`**: Sem mudanca (ja consome o hook corretamente)
6. **`src/components/playbooks/EmailFunnelChart.tsx`**: Sem mudanca (ja consome o hook corretamente)

## Resultado Esperado

| Metrica | Antes (errado) | Depois (correto) |
|---------|----------------|-------------------|
| Taxa de Entrega | 0.0% | ~100% (1212/1212) |
| Taxa de Abertura | 0.0% | ~50.1% (607/1212) |
| Taxa de Cliques | 0.0% | ~32.8% (199/607) |
| Conclusao Playbooks | 36.6% (truncado) | 44.7% (1708/3818) |
| Evolucao 7 dias | So linha de "sent" | 4 linhas (sent/delivered/opened/clicked) |
| Funil | So barra azul "Enviados" | 4 barras com dados reais |
| Performance Table | 0% open rate | Open rates reais por playbook |

## Impacto

- Zero regressao: nenhum componente visual e alterado, apenas a fonte de dados
- Performance melhorada: RPCs no banco em vez de fetch-all truncado
- Dados corretos: `email_sends` e a fonte de verdade (atualizada pelos webhooks do Resend)
- Sem limite de 1000 rows: contagens feitas no banco
