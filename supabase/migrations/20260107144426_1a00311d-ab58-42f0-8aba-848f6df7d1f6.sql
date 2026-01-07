-- Atualizar função de auto-assign para respeitar equipe do pipeline
CREATE OR REPLACE FUNCTION public.auto_assign_deal_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales_rep_id UUID;
  v_has_pipeline_team BOOLEAN;
BEGIN
  IF NEW.assigned_to IS NULL AND NEW.pipeline_id IS NOT NULL THEN
    -- Verificar se pipeline tem equipe específica
    SELECT EXISTS(
      SELECT 1 FROM pipeline_sales_reps WHERE pipeline_id = NEW.pipeline_id
    ) INTO v_has_pipeline_team;
    
    IF v_has_pipeline_team THEN
      -- Distribuir apenas entre vendedores do pipeline
      SELECT p.id INTO v_sales_rep_id
      FROM profiles p
      INNER JOIN pipeline_sales_reps psr ON psr.user_id = p.id
      LEFT JOIN deals d ON d.assigned_to = p.id AND d.status = 'open'
      WHERE psr.pipeline_id = NEW.pipeline_id
        AND (p.is_blocked IS NULL OR p.is_blocked = false)
      GROUP BY p.id
      ORDER BY COUNT(d.id) ASC, RANDOM()
      LIMIT 1;
    ELSE
      -- Fallback: qualquer vendedor ativo
      SELECT p.id INTO v_sales_rep_id
      FROM profiles p
      INNER JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN deals d ON d.assigned_to = p.id AND d.status = 'open'
      WHERE ur.role = 'sales_rep'
        AND (p.is_blocked IS NULL OR p.is_blocked = false)
      GROUP BY p.id
      ORDER BY COUNT(d.id) ASC, RANDOM()
      LIMIT 1;
    END IF;
    
    IF v_sales_rep_id IS NOT NULL THEN
      NEW.assigned_to := v_sales_rep_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Atualizar função get_assignee_for_form para aceitar pipeline_id
CREATE OR REPLACE FUNCTION public.get_assignee_for_form(
  p_distribution_rule TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_pipeline_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignee_id UUID;
  v_has_pipeline_team BOOLEAN;
BEGIN
  -- specific_user: usar usuário definido
  IF p_distribution_rule = 'specific_user' AND p_target_user_id IS NOT NULL THEN
    RETURN p_target_user_id;
  END IF;
  
  -- manager_only: gerente do departamento
  IF p_distribution_rule = 'manager_only' AND p_department_id IS NOT NULL THEN
    SELECT p.id INTO v_assignee_id
    FROM profiles p
    INNER JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.department = p_department_id
      AND ur.role IN ('manager', 'support_manager', 'cs_manager', 'general_manager')
      AND (p.is_blocked IS NULL OR p.is_blocked = false)
    LIMIT 1;
    
    IF v_assignee_id IS NOT NULL THEN
      RETURN v_assignee_id;
    END IF;
  END IF;
  
  -- round_robin: distribuir com filtro de pipeline (SE configurado)
  IF p_distribution_rule = 'round_robin' THEN
    -- Verificar se pipeline tem equipe
    IF p_pipeline_id IS NOT NULL THEN
      SELECT EXISTS(
        SELECT 1 FROM pipeline_sales_reps WHERE pipeline_id = p_pipeline_id
      ) INTO v_has_pipeline_team;
      
      IF v_has_pipeline_team THEN
        SELECT p.id INTO v_assignee_id
        FROM profiles p
        INNER JOIN pipeline_sales_reps psr ON psr.user_id = p.id
        LEFT JOIN deals d ON d.assigned_to = p.id AND d.status = 'open'
        WHERE psr.pipeline_id = p_pipeline_id
          AND (p.is_blocked IS NULL OR p.is_blocked = false)
        GROUP BY p.id
        ORDER BY COUNT(d.id) ASC, RANDOM()
        LIMIT 1;
        
        IF v_assignee_id IS NOT NULL THEN
          RETURN v_assignee_id;
        END IF;
      END IF;
    END IF;
    
    -- Fallback: departamento ou qualquer vendedor
    IF p_department_id IS NOT NULL THEN
      SELECT p.id INTO v_assignee_id
      FROM profiles p
      WHERE p.department = p_department_id
        AND (p.is_blocked IS NULL OR p.is_blocked = false)
      ORDER BY (
        (SELECT COUNT(*) FROM tickets t WHERE t.assigned_to = p.id AND t.status IN ('open', 'pending')) +
        (SELECT COUNT(*) FROM deals d WHERE d.assigned_to = p.id AND d.status = 'open')
      ) ASC, RANDOM()
      LIMIT 1;
    ELSE
      -- Fallback final: qualquer vendedor ativo
      SELECT p.id INTO v_assignee_id
      FROM profiles p
      INNER JOIN user_roles ur ON ur.user_id = p.id
      LEFT JOIN deals d ON d.assigned_to = p.id AND d.status = 'open'
      WHERE ur.role = 'sales_rep'
        AND (p.is_blocked IS NULL OR p.is_blocked = false)
      GROUP BY p.id
      ORDER BY COUNT(d.id) ASC, RANDOM()
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN v_assignee_id;
END;
$$;