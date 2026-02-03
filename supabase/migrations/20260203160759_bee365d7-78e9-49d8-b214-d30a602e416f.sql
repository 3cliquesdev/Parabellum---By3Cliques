-- ============================================
-- Políticas RLS para financial_manager e financial_agent
-- ============================================

-- 1. Política para financial_manager no inbox_view (acesso total)
CREATE POLICY financial_manager_view_inbox
ON public.inbox_view
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'financial_manager'::app_role));

-- 2. Política para financial_agent no inbox_view (seu departamento)
CREATE POLICY financial_agent_view_inbox
ON public.inbox_view
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'financial_agent'::app_role) AND (
    assigned_to = auth.uid() 
    OR (
      status = 'open' 
      AND assigned_to IS NULL 
      AND department IN (
        SELECT id FROM departments 
        WHERE name ILIKE ANY(ARRAY['Financeiro', 'Finance', 'Financial'])
      )
    )
  )
);

-- 3. Política para financial_manager em conversations (SELECT - acesso total)
CREATE POLICY financial_manager_can_view_all_conversations
ON public.conversations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'financial_manager'::app_role));

-- 4. Política para financial_manager em conversations (UPDATE)
CREATE POLICY financial_manager_can_update_conversations
ON public.conversations
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'financial_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'financial_manager'::app_role));

-- 5. Política para financial_agent em conversations (SELECT - seu departamento)
CREATE POLICY financial_agent_can_view_assigned_conversations
ON public.conversations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'financial_agent'::app_role) AND (
    assigned_to = auth.uid() 
    OR (
      status = 'open' 
      AND assigned_to IS NULL 
      AND department IN (
        SELECT id FROM departments 
        WHERE name ILIKE ANY(ARRAY['Financeiro', 'Finance', 'Financial'])
      )
    )
  )
);