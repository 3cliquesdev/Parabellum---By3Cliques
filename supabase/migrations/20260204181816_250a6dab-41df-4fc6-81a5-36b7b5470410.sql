-- =========================================
-- FASE 1: OTIMIZAÇÃO RLS - DEALS
-- =========================================

-- 1.1) Índices para RLS (se não existem)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
  ON public.user_roles(user_id, role);

CREATE INDEX IF NOT EXISTS idx_deals_assigned_updated
  ON public.deals(assigned_to, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_deals_pipeline_assigned_updated
  ON public.deals(pipeline_id, assigned_to, updated_at DESC);

-- 1.2) Remover SELECT policies redundantes (has_role)
DROP POLICY IF EXISTS cs_manager_can_view_all_deals ON public.deals;
DROP POLICY IF EXISTS financial_manager_can_view_deals ON public.deals;
DROP POLICY IF EXISTS support_manager_can_view_deals ON public.deals;
DROP POLICY IF EXISTS support_manager_can_view_all_deals ON public.deals;
DROP POLICY IF EXISTS role_based_select_deals ON public.deals;

-- 1.3) Garantir 1 única SELECT policy canônica
DROP POLICY IF EXISTS optimized_select_deals ON public.deals;
CREATE POLICY optimized_select_deals
ON public.deals
FOR SELECT
TO authenticated
USING (
  -- Acesso total (avaliado 1x por query, não por linha)
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin','manager','general_manager',
        'support_manager','cs_manager','financial_manager'
      )
  )
  OR
  -- Acesso restrito aos próprios deals
  (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('sales_rep','user','consultant')
    )
  )
);

-- 1.4) Reescrever UPDATE sem has_role
DROP POLICY IF EXISTS role_based_update_deals ON public.deals;
CREATE POLICY role_based_update_deals
ON public.deals
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','manager','general_manager')
  )
  OR
  (
    assigned_to = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('sales_rep','user')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','manager','general_manager','sales_rep','user')
  )
);

-- 1.5) Reescrever INSERT sem has_role
DROP POLICY IF EXISTS role_based_insert_deals ON public.deals;
CREATE POLICY role_based_insert_deals
ON public.deals
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','manager','general_manager','sales_rep','user')
  )
);

-- =========================================
-- FASE 2: OTIMIZAÇÃO RLS - CONVERSATIONS
-- =========================================

-- 2.1) Remover SELECT policies redundantes de conversations
DROP POLICY IF EXISTS admin_manager_full_access_conversations ON public.conversations;
DROP POLICY IF EXISTS cs_manager_can_view_all_conversations ON public.conversations;
DROP POLICY IF EXISTS financial_manager_can_view_all_conversations ON public.conversations;
DROP POLICY IF EXISTS general_manager_can_view_all_conversations ON public.conversations;
DROP POLICY IF EXISTS support_manager_can_view_all_support_conversations ON public.conversations;
DROP POLICY IF EXISTS consultant_can_view_assigned_conversations ON public.conversations;

-- 2.2) Criar SELECT policy unificada para conversations
DROP POLICY IF EXISTS optimized_select_conversations ON public.conversations;
CREATE POLICY optimized_select_conversations
ON public.conversations
FOR SELECT
TO authenticated
USING (
  -- Managers: acesso total
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin','manager','general_manager',
        'support_manager','cs_manager','financial_manager'
      )
  )
  OR
  -- Assigned user: próprias conversas
  (assigned_to = auth.uid())
  OR
  -- Sales_rep: departamento comercial unassigned
  (
    status = 'open' AND assigned_to IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'sales_rep'
    )
    AND department IN (SELECT id FROM departments WHERE name IN ('Comercial','Vendas'))
  )
  OR
  -- Support_agent: departamento suporte unassigned
  (
    status = 'open' AND assigned_to IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'support_agent'
    )
    AND department IN (SELECT id FROM departments WHERE name = 'Suporte')
  )
  OR
  -- Financial_agent: departamentos financeiros unassigned
  (
    status = 'open' AND assigned_to IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'financial_agent'
    )
    AND department IN (SELECT id FROM departments WHERE name ILIKE ANY(ARRAY['Financeiro','Finance','Financial']))
  )
  OR
  -- User role: mesmo departamento unassigned
  (
    status = 'open' AND assigned_to IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'user'
    )
    AND department = (SELECT department FROM profiles WHERE id = auth.uid())
  )
  OR
  -- Web chat anon (manter funcionalidade existente)
  (
    channel = 'web_chat' AND session_token IS NOT NULL
    AND session_token = ((current_setting('request.headers', true))::json->>'x-session-token')
  )
);

-- =========================================
-- FASE 2.3: OTIMIZAÇÃO RLS - INBOX_VIEW
-- =========================================

-- Remover policies redundantes
DROP POLICY IF EXISTS admin_manager_full_access_inbox_view ON public.inbox_view;
DROP POLICY IF EXISTS optimized_admin_manager_inbox ON public.inbox_view;

-- Criar policy canônica unificada
DROP POLICY IF EXISTS optimized_inbox_select ON public.inbox_view;
CREATE POLICY optimized_inbox_select
ON public.inbox_view
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN (
        'admin','manager','general_manager',
        'support_manager','cs_manager','financial_manager'
      )
  )
  OR assigned_to = auth.uid()
);