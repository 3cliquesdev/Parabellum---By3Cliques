-- ============================================
-- TABELA: internal_requests para Solicitações Internas
-- ============================================
CREATE TABLE public.internal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'general',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  department_id UUID REFERENCES departments(id),
  assigned_to UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  contact_id UUID REFERENCES contacts(id),
  form_submission_id UUID REFERENCES form_submissions(id),
  metadata JSONB DEFAULT '{}',
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_internal_requests_updated_at
  BEFORE UPDATE ON internal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE internal_requests ENABLE ROW LEVEL SECURITY;

-- Admin/Manager podem gerenciar todas
CREATE POLICY "admin_manager_can_manage_internal_requests"
  ON internal_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Usuário atribuído pode ver e atualizar suas solicitações
CREATE POLICY "assigned_can_view_update_internal_requests"
  ON internal_requests FOR ALL
  USING (assigned_to = auth.uid())
  WITH CHECK (assigned_to = auth.uid());

-- Qualquer usuário autenticado pode criar
CREATE POLICY "authenticated_can_create_internal_requests"
  ON internal_requests FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Usuário que criou pode ver
CREATE POLICY "creator_can_view_internal_requests"
  ON internal_requests FOR SELECT
  USING (created_by = auth.uid());

-- ============================================
-- FUNÇÃO: get_assignee_for_form() para lógica de distribuição
-- ============================================
CREATE OR REPLACE FUNCTION public.get_assignee_for_form(
  p_distribution_rule TEXT,
  p_target_user_id UUID,
  p_department_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_assignee_id UUID;
BEGIN
  -- 1. specific_user: usar usuário definido diretamente
  IF p_distribution_rule = 'specific_user' AND p_target_user_id IS NOT NULL THEN
    RETURN p_target_user_id;
  END IF;
  
  -- 2. manager_only: buscar gerente do departamento
  IF p_distribution_rule = 'manager_only' AND p_department_id IS NOT NULL THEN
    -- Buscar um usuário com role de manager no departamento
    SELECT p.id INTO v_assignee_id
    FROM profiles p
    INNER JOIN user_roles ur ON ur.user_id = p.id
    WHERE p.department = p_department_id
      AND ur.role IN ('manager', 'support_manager', 'cs_manager', 'general_manager', 'financial_manager')
      AND (p.is_blocked IS NULL OR p.is_blocked = false)
    LIMIT 1;
    
    IF v_assignee_id IS NOT NULL THEN
      RETURN v_assignee_id;
    END IF;
  END IF;
  
  -- 3. round_robin: distribuir para membro com menos carga no departamento
  IF p_distribution_rule = 'round_robin' AND p_department_id IS NOT NULL THEN
    SELECT p.id INTO v_assignee_id
    FROM profiles p
    WHERE p.department = p_department_id
      AND (p.is_blocked IS NULL OR p.is_blocked = false)
    ORDER BY (
      -- Contar tickets abertos + deals abertos
      (SELECT COUNT(*) FROM tickets t WHERE t.assigned_to = p.id AND t.status IN ('open', 'pending')) +
      (SELECT COUNT(*) FROM deals d WHERE d.assigned_to = p.id AND d.status = 'open')
    ) ASC, RANDOM()
    LIMIT 1;
    
    IF v_assignee_id IS NOT NULL THEN
      RETURN v_assignee_id;
    END IF;
  END IF;
  
  -- Fallback: retornar NULL se nenhuma regra aplicável
  RETURN NULL;
END;
$function$;