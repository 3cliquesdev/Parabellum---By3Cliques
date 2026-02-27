CREATE OR REPLACE FUNCTION public.get_support_dashboard_counts(p_start timestamptz, p_end timestamptz)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_tickets_open integer;
  v_conversations_total integer;
  v_conversations_closed integer;
  v_sla_risk integer;
BEGIN
  SELECT COUNT(*) INTO v_tickets_open
  FROM tickets
  WHERE created_at >= p_start AND created_at < p_end
    AND status NOT IN ('closed', 'resolved');

  SELECT COUNT(*) INTO v_conversations_total
  FROM conversations
  WHERE created_at >= p_start AND created_at < p_end;

  SELECT COUNT(*) INTO v_conversations_closed
  FROM conversations
  WHERE closed_at >= p_start AND closed_at < p_end
    AND status IN ('closed', 'resolved');

  SELECT COUNT(*) INTO v_sla_risk
  FROM tickets
  WHERE created_at >= p_start AND created_at < p_end
    AND due_date IS NOT NULL
    AND due_date < now()
    AND status NOT IN ('closed', 'resolved');

  RETURN jsonb_build_object(
    'tickets_open', v_tickets_open,
    'conversations_total', v_conversations_total,
    'conversations_closed', v_conversations_closed,
    'sla_risk', v_sla_risk
  );
END;
$$;