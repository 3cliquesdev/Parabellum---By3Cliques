-- ===============================================
-- FASE 1: BACKUP DE SEGURANÇA
-- ===============================================

CREATE TABLE IF NOT EXISTS public.rls_policy_backup (
  id serial PRIMARY KEY,
  backed_up_at timestamptz DEFAULT now(),
  schemaname text,
  tablename text,
  policyname text,
  cmd text,
  qual text,
  with_check text
);

INSERT INTO public.rls_policy_backup (schemaname, tablename, policyname, cmd, qual, with_check)
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('conversations', 'tickets');

-- ===============================================
-- FASE 2: CONSOLIDAR SELECT EM CONVERSATIONS (6 → 2)
-- ===============================================

-- Dropar policies SELECT redundantes (manter anon_can_read_own_web_chat_session)
DROP POLICY IF EXISTS financial_agent_can_view_assigned_conversations ON public.conversations;
DROP POLICY IF EXISTS sales_rep_can_view_sales_conversations ON public.conversations;
DROP POLICY IF EXISTS support_agent_can_view_assigned_conversations ON public.conversations;
DROP POLICY IF EXISTS user_can_view_department_conversations ON public.conversations;
DROP POLICY IF EXISTS optimized_select_conversations ON public.conversations;

-- Criar policy canônica para SELECT em conversations
CREATE POLICY canonical_select_conversations
ON public.conversations
FOR SELECT
TO authenticated
USING (
  -- Managers: acesso total (1 avaliação via SECURITY DEFINER)
  public.has_any_role(
    auth.uid(),
    ARRAY['admin','manager','general_manager','support_manager','cs_manager','financial_manager']::app_role[]
  )
  OR
  -- Minha conversa (assigned_to = eu)
  (assigned_to = auth.uid())
  OR
  -- Pool do meu dept: OPEN + unassigned + mesmo departamento
  (
    status = 'open'
    AND assigned_to IS NULL
    AND public.has_any_role(
      auth.uid(),
      ARRAY['sales_rep','support_agent','financial_agent','consultant']::app_role[]
    )
    AND department = (SELECT department FROM public.profiles WHERE id = auth.uid())
  )
  OR
  -- Pool global: OPEN + unassigned + sem departamento
  (
    status = 'open'
    AND assigned_to IS NULL
    AND department IS NULL
    AND public.has_any_role(
      auth.uid(),
      ARRAY['sales_rep','support_agent','financial_agent','consultant']::app_role[]
    )
  )
  OR
  -- Web chat session (para authenticated users também)
  (
    channel = 'web_chat'
    AND session_token IS NOT NULL
    AND session_token = (current_setting('request.headers', true)::json ->> 'x-session-token')
  )
);

-- ===============================================
-- FASE 3: CONSOLIDAR SELECT EM TICKETS (10 → 1)
-- ===============================================

-- Dropar todas as SELECT policies redundantes
DROP POLICY IF EXISTS consultant_can_view_tickets ON public.tickets;
DROP POLICY IF EXISTS cs_manager_can_view_all_tickets ON public.tickets;
DROP POLICY IF EXISTS ecommerce_analyst_can_view_tickets ON public.tickets;
DROP POLICY IF EXISTS financial_agent_can_view_tickets ON public.tickets;
DROP POLICY IF EXISTS financial_managers_can_view_all_tickets ON public.tickets;
DROP POLICY IF EXISTS management_can_view_all_tickets ON public.tickets;
DROP POLICY IF EXISTS sales_rep_can_view_tickets ON public.tickets;
DROP POLICY IF EXISTS support_agent_can_view_tickets ON public.tickets;
DROP POLICY IF EXISTS support_manager_can_view_all_tickets ON public.tickets;
DROP POLICY IF EXISTS user_can_view_own_tickets ON public.tickets;

-- Criar policy canônica para SELECT em tickets
CREATE POLICY canonical_select_tickets
ON public.tickets
FOR SELECT
TO authenticated
USING (
  -- Managers veem tudo
  public.has_any_role(
    auth.uid(),
    ARRAY['admin','manager','general_manager','support_manager','cs_manager','financial_manager']::app_role[]
  )
  OR
  -- Meu ticket (atribuído a mim)
  (assigned_to = auth.uid())
  OR
  -- Ticket que eu criei
  (created_by = auth.uid())
  OR
  -- Pool do meu dept: OPEN + unassigned
  (
    public.has_any_role(
      auth.uid(),
      ARRAY['support_agent','financial_agent','ecommerce_analyst']::app_role[]
    )
    AND status = 'open'
    AND assigned_to IS NULL
    AND department_id = (SELECT department FROM public.profiles WHERE id = auth.uid())
  )
  OR
  -- Sales rep: tickets dos meus contatos
  (
    public.has_any_role(auth.uid(), ARRAY['sales_rep']::app_role[])
    AND customer_id IN (SELECT id FROM public.contacts WHERE assigned_to = auth.uid())
  )
  OR
  -- Consultant: tickets dos meus contatos
  (
    public.has_any_role(auth.uid(), ARRAY['consultant']::app_role[])
    AND customer_id IN (SELECT get_consultant_contact_ids(auth.uid()))
  )
  OR
  -- User: apenas tickets que criou (redundante mas explícito)
  (
    public.has_any_role(auth.uid(), ARRAY['user']::app_role[])
    AND created_by = auth.uid()
  )
);

-- ===============================================
-- FASE 4: CONSOLIDAR UPDATE EM CONVERSATIONS (5 → 2)
-- ===============================================

-- Dropar policies UPDATE redundantes (manter anon_can_update_own_web_chat_session)
DROP POLICY IF EXISTS cs_manager_can_update_conversations ON public.conversations;
DROP POLICY IF EXISTS financial_manager_can_update_conversations ON public.conversations;
DROP POLICY IF EXISTS general_manager_can_update_conversations ON public.conversations;
DROP POLICY IF EXISTS support_manager_can_update_all_conversations ON public.conversations;
DROP POLICY IF EXISTS agents_can_update_and_transfer_conversations ON public.conversations;

-- Criar policy canônica para UPDATE em conversations
CREATE POLICY canonical_update_conversations
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  public.has_any_role(
    auth.uid(),
    ARRAY['admin','manager','general_manager','support_manager','cs_manager','financial_manager']::app_role[]
  )
  OR
  (assigned_to = auth.uid())
)
WITH CHECK (
  public.has_any_role(
    auth.uid(),
    ARRAY['admin','manager','general_manager','support_manager','cs_manager','financial_manager']::app_role[]
  )
  OR
  (assigned_to = auth.uid())
);

-- ===============================================
-- FASE 5: CONSOLIDAR UPDATE EM TICKETS (5 → 1)
-- ===============================================

-- Dropar policies UPDATE redundantes
DROP POLICY IF EXISTS ecommerce_analyst_can_update_tickets ON public.tickets;
DROP POLICY IF EXISTS financial_agent_can_update_tickets ON public.tickets;
DROP POLICY IF EXISTS financial_managers_can_update_tickets ON public.tickets;
DROP POLICY IF EXISTS support_agent_can_update_tickets ON public.tickets;
DROP POLICY IF EXISTS support_manager_can_update_all_tickets ON public.tickets;

-- Criar policy canônica para UPDATE em tickets
CREATE POLICY canonical_update_tickets
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  public.has_any_role(
    auth.uid(),
    ARRAY['admin','manager','general_manager','support_manager','cs_manager','financial_manager']::app_role[]
  )
  OR
  (assigned_to = auth.uid())
  OR
  (created_by = auth.uid())
)
WITH CHECK (
  public.has_any_role(
    auth.uid(),
    ARRAY['admin','manager','general_manager','support_manager','cs_manager','financial_manager']::app_role[]
  )
  OR
  (assigned_to = auth.uid())
  OR
  (created_by = auth.uid())
);

-- ===============================================
-- FASE 6: ÍNDICES ADICIONAIS
-- ===============================================

CREATE INDEX IF NOT EXISTS idx_tickets_created_by 
ON public.tickets(created_by);

CREATE INDEX IF NOT EXISTS idx_tickets_dept_assigned_status 
ON public.tickets(department_id, assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_conversations_dept_assigned_status 
ON public.conversations(department, assigned_to, status);

-- ===============================================
-- FASE 7: RPC PARA RLS HEALTH CHECK
-- ===============================================

CREATE OR REPLACE FUNCTION public.audit_rls_health()
RETURNS TABLE (
  table_name text,
  total_policies int,
  has_role_policies int,
  select_policies int,
  update_policies int,
  insert_policies int,
  delete_policies int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    tablename::text as table_name,
    count(*)::int as total_policies,
    sum(CASE WHEN qual ILIKE '%has_role%' OR with_check ILIKE '%has_role%' THEN 1 ELSE 0 END)::int as has_role_policies,
    sum(CASE WHEN cmd = 'SELECT' THEN 1 ELSE 0 END)::int as select_policies,
    sum(CASE WHEN cmd = 'UPDATE' THEN 1 ELSE 0 END)::int as update_policies,
    sum(CASE WHEN cmd = 'INSERT' THEN 1 ELSE 0 END)::int as insert_policies,
    sum(CASE WHEN cmd = 'DELETE' THEN 1 ELSE 0 END)::int as delete_policies
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
  ORDER BY has_role_policies DESC, total_policies DESC;
$$;