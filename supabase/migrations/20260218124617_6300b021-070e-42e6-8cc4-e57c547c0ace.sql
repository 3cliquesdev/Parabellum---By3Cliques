
CREATE OR REPLACE FUNCTION public.get_playbook_email_sequence_report(
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end TIMESTAMPTZ DEFAULT NULL,
  p_playbook_id UUID DEFAULT NULL
)
RETURNS TABLE(
  execution_id UUID,
  contact_name TEXT,
  contact_email TEXT,
  playbook_name TEXT,
  sale_date TIMESTAMPTZ,
  email_order BIGINT,
  email_subject TEXT,
  email_sent_at TIMESTAMPTZ,
  email_opened_at TIMESTAMPTZ,
  email_clicked_at TIMESTAMPTZ,
  email_bounced_at TIMESTAMPTZ,
  email_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pe.id AS execution_id,
    (c.first_name || ' ' || c.last_name)::TEXT AS contact_name,
    c.email::TEXT AS contact_email,
    p.name::TEXT AS playbook_name,
    pe.started_at AS sale_date,
    ROW_NUMBER() OVER (PARTITION BY pe.id ORDER BY es.sent_at NULLS LAST) AS email_order,
    es.subject::TEXT AS email_subject,
    es.sent_at AS email_sent_at,
    es.opened_at AS email_opened_at,
    es.clicked_at AS email_clicked_at,
    es.bounced_at AS email_bounced_at,
    es.status::TEXT AS email_status
  FROM playbook_executions pe
  JOIN contacts c ON c.id = pe.contact_id
  JOIN onboarding_playbooks p ON p.id = pe.playbook_id
  LEFT JOIN email_sends es ON es.playbook_execution_id = pe.id
  WHERE (p_start IS NULL OR pe.started_at >= p_start)
    AND (p_end IS NULL OR pe.started_at <= p_end)
    AND (p_playbook_id IS NULL OR pe.playbook_id = p_playbook_id)
  ORDER BY pe.started_at DESC, es.sent_at ASC;
END;
$$;
