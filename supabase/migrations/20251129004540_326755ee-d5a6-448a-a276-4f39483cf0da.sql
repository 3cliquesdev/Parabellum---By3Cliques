-- FASE 2: Update RLS policies for tickets and conversations tables
-- Now support_manager enum value is committed and can be used

-- ============================================
-- TICKETS TABLE RLS POLICIES
-- ============================================

-- Drop existing policies
DROP POLICY IF EXISTS "role_based_select_tickets" ON public.tickets;
DROP POLICY IF EXISTS "role_based_insert_tickets" ON public.tickets;
DROP POLICY IF EXISTS "role_based_update_tickets" ON public.tickets;
DROP POLICY IF EXISTS "role_based_delete_tickets" ON public.tickets;

-- SUPPORT AGENT: Can only see assigned or unassigned tickets
CREATE POLICY "support_agent_can_view_assigned_or_unassigned_tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
);

-- SUPPORT AGENT: Can update only assigned tickets
CREATE POLICY "support_agent_can_update_assigned_tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND assigned_to = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND assigned_to = auth.uid()
);

-- SUPPORT MANAGER: Full read access to ALL tickets
CREATE POLICY "support_manager_can_view_all_tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'support_manager'::app_role));

-- SUPPORT MANAGER: Full update access to ALL tickets
CREATE POLICY "support_manager_can_update_all_tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'support_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'support_manager'::app_role));

-- SUPPORT MANAGER: Can delete tickets (spam cleanup)
CREATE POLICY "support_manager_can_delete_tickets"
ON public.tickets
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'support_manager'::app_role));

-- ADMIN/MANAGER: Keep existing full access
CREATE POLICY "admin_manager_full_access_tickets"
ON public.tickets
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

-- FINANCIAL MANAGER: Can manage financial tickets
CREATE POLICY "financial_manager_can_manage_financial_tickets"
ON public.tickets
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'financial_manager'::app_role) 
  AND category = 'financeiro'
)
WITH CHECK (
  has_role(auth.uid(), 'financial_manager'::app_role)
);

-- ============================================
-- CONVERSATIONS TABLE RLS POLICIES
-- ============================================

-- Drop existing support_agent policies
DROP POLICY IF EXISTS "role_based_select_conversations_with_dept" ON public.conversations;
DROP POLICY IF EXISTS "role_based_update_conversations_with_dept" ON public.conversations;

-- SUPPORT AGENT: Can only see assigned conversations or unassigned in Support department
CREATE POLICY "support_agent_can_view_assigned_conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND (
    assigned_to = auth.uid() 
    OR (assigned_to IS NULL AND department IN (
      SELECT id FROM departments WHERE name = 'Suporte'
    ))
  )
);

-- SUPPORT AGENT: Can update only assigned conversations
CREATE POLICY "support_agent_can_update_assigned_conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND assigned_to = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND assigned_to = auth.uid()
);

-- SUPPORT MANAGER: Full read/write access to ALL support conversations
CREATE POLICY "support_manager_can_view_all_support_conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'support_manager'::app_role));

-- SUPPORT MANAGER: Full update access
CREATE POLICY "support_manager_can_update_all_conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'support_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'support_manager'::app_role));

-- Keep existing admin/manager/sales_rep/consultant policies
CREATE POLICY "admin_manager_full_access_conversations"
ON public.conversations
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "sales_rep_can_view_sales_conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'sales_rep'::app_role) 
  AND (
    assigned_to = auth.uid() 
    OR department IN (
      SELECT id FROM departments WHERE name IN ('Comercial', 'Vendas')
    )
  )
);

CREATE POLICY "consultant_can_view_assigned_conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'consultant'::app_role) 
  AND assigned_to = auth.uid()
);