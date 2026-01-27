-- =====================================================
-- CORRIGIR RLS: Permitir agentes verem histórico de conversas fechadas
-- =====================================================

-- 1. Corrigir RLS de conversations para sales_rep
DROP POLICY IF EXISTS "sales_rep_can_view_sales_conversations" ON public.conversations;
CREATE POLICY "sales_rep_can_view_sales_conversations" ON public.conversations
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'sales_rep'::app_role) AND (
    -- Pode ver QUALQUER conversa atribuída a ele (aberta ou fechada)
    assigned_to = auth.uid()
    OR
    -- Pode ver conversas NÃO atribuídas do departamento (apenas abertas)
    (status = 'open' AND assigned_to IS NULL AND department IN (
      SELECT id FROM departments WHERE name = ANY(ARRAY['Comercial', 'Vendas'])
    ))
  )
);

-- 2. Corrigir RLS de conversations para support_agent
DROP POLICY IF EXISTS "support_agent_can_view_assigned_conversations" ON public.conversations;
CREATE POLICY "support_agent_can_view_assigned_conversations" ON public.conversations
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role) AND (
    assigned_to = auth.uid()
    OR
    (status = 'open' AND assigned_to IS NULL AND department IN (
      SELECT id FROM departments WHERE name = 'Suporte'
    ))
  )
);

-- 3. Corrigir RLS de conversations para user
DROP POLICY IF EXISTS "user_can_view_department_conversations" ON public.conversations;
CREATE POLICY "user_can_view_department_conversations" ON public.conversations
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'user'::app_role) AND (
    assigned_to = auth.uid()
    OR
    (status = 'open' AND assigned_to IS NULL AND department = (
      SELECT department FROM profiles WHERE id = auth.uid()
    ))
  )
);

-- 4. Corrigir RLS de inbox_view para sales_rep
DROP POLICY IF EXISTS "sales_rep_view_sales_inbox" ON public.inbox_view;
CREATE POLICY "sales_rep_view_sales_inbox" ON public.inbox_view
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'sales_rep'::app_role) AND (
    assigned_to = auth.uid()
    OR
    (status = 'open' AND assigned_to IS NULL AND department IN (
      SELECT id FROM departments WHERE name = ANY(ARRAY['Comercial', 'Vendas'])
    ))
  )
);

-- 5. Corrigir RLS de inbox_view para support_agent
DROP POLICY IF EXISTS "support_agent_view_assigned_inbox" ON public.inbox_view;
CREATE POLICY "support_agent_view_assigned_inbox" ON public.inbox_view
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role) AND (
    assigned_to = auth.uid()
    OR
    (status = 'open' AND assigned_to IS NULL AND department IN (
      SELECT id FROM departments WHERE name = 'Suporte'
    ))
  )
);

-- 6. Corrigir RLS de inbox_view para user
DROP POLICY IF EXISTS "user_view_department_inbox" ON public.inbox_view;
CREATE POLICY "user_view_department_inbox" ON public.inbox_view
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'user'::app_role) AND (
    assigned_to = auth.uid()
    OR
    (status = 'open' AND assigned_to IS NULL AND department = (
      SELECT department FROM profiles WHERE id = auth.uid()
    ))
  )
);