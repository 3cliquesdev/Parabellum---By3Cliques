
-- Update get_playbook_kpis with date filtering
CREATE OR REPLACE FUNCTION get_playbook_kpis(
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object(
    'totalExecutions', (SELECT COUNT(*) FROM playbook_executions WHERE (p_start IS NULL OR created_at >= p_start) AND (p_end IS NULL OR created_at <= p_end)),
    'running', (SELECT COUNT(*) FROM playbook_executions WHERE status = 'running' AND (p_start IS NULL OR created_at >= p_start) AND (p_end IS NULL OR created_at <= p_end)),
    'completed', (SELECT COUNT(*) FROM playbook_executions WHERE status LIKE '%completed%' AND (p_start IS NULL OR created_at >= p_start) AND (p_end IS NULL OR created_at <= p_end)),
    'failed', (SELECT COUNT(*) FROM playbook_executions WHERE status = 'failed' AND (p_start IS NULL OR created_at >= p_start) AND (p_end IS NULL OR created_at <= p_end)),
    'emails', jsonb_build_object(
      'sent', (SELECT COUNT(*) FROM email_sends WHERE (p_start IS NULL OR sent_at >= p_start) AND (p_end IS NULL OR sent_at <= p_end)),
      'delivered', (SELECT COUNT(*) FROM email_sends WHERE bounced_at IS NULL AND (p_start IS NULL OR sent_at >= p_start) AND (p_end IS NULL OR sent_at <= p_end)),
      'opened', (SELECT COUNT(*) FROM email_sends WHERE opened_at IS NOT NULL AND (p_start IS NULL OR sent_at >= p_start) AND (p_end IS NULL OR sent_at <= p_end)),
      'clicked', (SELECT COUNT(*) FROM email_sends WHERE clicked_at IS NOT NULL AND (p_start IS NULL OR sent_at >= p_start) AND (p_end IS NULL OR sent_at <= p_end)),
      'bounced', (SELECT COUNT(*) FROM email_sends WHERE bounced_at IS NOT NULL AND (p_start IS NULL OR sent_at >= p_start) AND (p_end IS NULL OR sent_at <= p_end))
    )
  )
$$;

-- Update get_email_evolution with date filtering
CREATE OR REPLACE FUNCTION get_email_evolution(
  p_days int DEFAULT 7,
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
RETURNS TABLE(day date, sent bigint, delivered bigint, opened bigint, clicked bigint)
LANGUAGE sql STABLE AS $$
  SELECT 
    date_trunc('day', sent_at)::date as day,
    COUNT(*) as sent,
    COUNT(CASE WHEN bounced_at IS NULL THEN 1 END) as delivered,
    COUNT(opened_at) as opened,
    COUNT(clicked_at) as clicked
  FROM email_sends
  WHERE 
    CASE 
      WHEN p_start IS NOT NULL AND p_end IS NOT NULL THEN sent_at >= p_start AND sent_at <= p_end
      ELSE sent_at >= CURRENT_DATE - p_days
    END
  GROUP BY day
  ORDER BY day
$$;

-- Update get_playbook_performance with date filtering
CREATE OR REPLACE FUNCTION get_playbook_performance(
  p_start timestamptz DEFAULT NULL,
  p_end timestamptz DEFAULT NULL
)
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
  WHERE (p_start IS NULL OR pe.created_at >= p_start) AND (p_end IS NULL OR pe.created_at <= p_end)
  GROUP BY pe.playbook_id, op.name
  ORDER BY executions DESC
$$;
