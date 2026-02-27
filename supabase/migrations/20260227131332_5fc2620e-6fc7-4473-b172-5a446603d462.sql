CREATE OR REPLACE FUNCTION public.get_support_dashboard_counts(p_start timestamptz, p_end timestamptz)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tickets_open int;
  v_conversations_open int;
  v_conversations_closed int;
  v_sla_risk int;
BEGIN
  -- Operational KPIs: current state, NO date filter
  SELECT COUNT(*) INTO v_tickets_open
  FROM tickets
  WHERE status NOT IN ('resolved', 'closed');

  SELECT COUNT(*) INTO v_conversations_open
  FROM conversations
  WHERE status NOT IN ('closed', 'resolved');

  SELECT COUNT(*) INTO v_sla_risk
  FROM tickets
  WHERE due_date IS NOT NULL
    AND due_date < now()
    AND status NOT IN ('resolved', 'closed');

  -- Period KPI: conversations closed within selected range
  SELECT COUNT(*) INTO v_conversations_closed
  FROM conversations
  WHERE closed_at >= p_start AND closed_at < p_end;

  RETURN json_build_object(
    'tickets_open', COALESCE(v_tickets_open, 0),
    'conversations_open', COALESCE(v_conversations_open, 0),
    'conversations_closed', COALESCE(v_conversations_closed, 0),
    'sla_risk', COALESCE(v_sla_risk, 0)
  );
END;
$$;