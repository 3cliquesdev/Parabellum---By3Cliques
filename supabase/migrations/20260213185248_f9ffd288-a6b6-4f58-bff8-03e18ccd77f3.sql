CREATE OR REPLACE FUNCTION public.transfer_ticket_secure(
  p_ticket_id uuid, 
  p_department_id uuid, 
  p_assigned_to uuid DEFAULT NULL, 
  p_internal_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_ticket RECORD;
  v_is_authorized BOOLEAN := false;
  v_dept_name TEXT;
  v_assignee_name TEXT;
  v_has_transfer_perm BOOLEAN := false;
BEGIN
  -- 1. Buscar ticket
  SELECT id, assigned_to, created_by, department_id
  INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Ticket não encontrado');
  END IF;

  -- 2. Verificar autorização
  -- Managers/admins: acesso total
  IF has_any_role(v_caller_id, ARRAY[
    'admin','manager','general_manager',
    'cs_manager','support_manager','financial_manager'
  ]::app_role[]) THEN
    v_is_authorized := true;
  ELSIF has_any_role(v_caller_id, ARRAY[
    'support_agent','financial_agent','ecommerce_analyst','sales_rep'
  ]::app_role[]) THEN
    -- Verificar permissão inbox.transfer
    SELECT EXISTS (
      SELECT 1 FROM role_permissions rp
      JOIN user_roles ur ON ur.role = rp.role
      WHERE ur.user_id = v_caller_id
        AND rp.permission_key = 'inbox.transfer'
        AND rp.enabled = true
    ) INTO v_has_transfer_perm;

    v_is_authorized := (
      v_ticket.assigned_to = v_caller_id        -- Atribuído a ele
      OR v_ticket.created_by = v_caller_id       -- Criado por ele
      OR v_ticket.assigned_to IS NULL            -- Sem dono
      OR v_ticket.department_id IN (             -- No departamento dele (N:N)
           SELECT department_id FROM agent_departments
           WHERE profile_id = v_caller_id
         )
      OR v_has_transfer_perm                     -- Tem permissão inbox.transfer
    );
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Sem permissão para transferir este ticket'
    );
  END IF;

  -- 3. Buscar nome do departamento
  SELECT name INTO v_dept_name FROM departments WHERE id = p_department_id;

  -- 4. Buscar nome do assignee se fornecido
  IF p_assigned_to IS NOT NULL THEN
    SELECT full_name INTO v_assignee_name FROM profiles WHERE id = p_assigned_to;
  END IF;

  -- 5. Executar transferência
  UPDATE tickets
  SET 
    department_id = p_department_id,
    assigned_to = p_assigned_to,
    status = CASE 
      WHEN p_assigned_to IS NOT NULL THEN 'in_progress'
      ELSE 'open'
    END,
    updated_at = now()
  WHERE id = p_ticket_id;

  -- 6. Criar comentário interno
  IF p_internal_note IS NOT NULL AND p_internal_note != '' THEN
    INSERT INTO ticket_comments (ticket_id, content, is_internal, created_by)
    VALUES (
      p_ticket_id, 
      format('📤 Ticket transferido para %s%s\n\n%s', 
        COALESCE(v_dept_name, 'Departamento'), 
        CASE WHEN v_assignee_name IS NOT NULL THEN format(' (atribuído para %s)', v_assignee_name) ELSE '' END,
        p_internal_note
      ), 
      true, 
      v_caller_id
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'department_id', p_department_id,
    'department_name', v_dept_name,
    'assigned_to', p_assigned_to,
    'assignee_name', v_assignee_name
  );
END;
$$;