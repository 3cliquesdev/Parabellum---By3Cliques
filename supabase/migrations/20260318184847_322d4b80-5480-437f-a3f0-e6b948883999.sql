
CREATE OR REPLACE FUNCTION public.assign_ticket_secure(
  p_ticket_id uuid,
  p_assigned_to uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_is_authorized BOOLEAN := false;
BEGIN
  -- Managers/admins: acesso total
  IF has_any_role(v_caller_id, ARRAY[
    'admin','manager','general_manager',
    'cs_manager','support_manager','financial_manager'
  ]::app_role[]) THEN
    v_is_authorized := true;
  -- Agentes operacionais e consultores podem atribuir
  ELSIF has_any_role(v_caller_id, ARRAY[
    'support_agent','financial_agent','consultant',
    'ecommerce_analyst','sales_rep'
  ]::app_role[]) THEN
    v_is_authorized := true;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para atribuir tickets');
  END IF;

  UPDATE tickets
  SET assigned_to = p_assigned_to,
      status = CASE 
        WHEN p_assigned_to IS NOT NULL AND status = 'open' THEN 'in_progress'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_ticket_id;

  RETURN jsonb_build_object('success', true, 'ticket_id', p_ticket_id);
END;
$$;

REVOKE ALL ON FUNCTION public.assign_ticket_secure(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_ticket_secure(uuid, uuid) TO authenticated;
