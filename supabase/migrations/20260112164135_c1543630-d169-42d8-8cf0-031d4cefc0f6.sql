-- Correção 1: Atualizar RLS da tabela kiwify_events para incluir financial_agent
DROP POLICY IF EXISTS "admin_manager_can_view_kiwify_events" ON kiwify_events;

CREATE POLICY "authorized_roles_can_view_kiwify_events" ON kiwify_events
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'financial_manager'::app_role) OR
  has_role(auth.uid(), 'financial_agent'::app_role)
);

-- Correção 2: Atualizar RLS da tabela contacts para incluir financial_agent
DROP POLICY IF EXISTS "role_based_select_contacts" ON contacts;

CREATE POLICY "role_based_select_contacts" ON contacts
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR 
  has_role(auth.uid(), 'cs_manager'::app_role) OR 
  has_role(auth.uid(), 'support_manager'::app_role) OR 
  has_role(auth.uid(), 'financial_manager'::app_role) OR 
  has_role(auth.uid(), 'financial_agent'::app_role) OR
  has_role(auth.uid(), 'support_agent'::app_role) OR 
  (has_role(auth.uid(), 'sales_rep'::app_role) AND (assigned_to = auth.uid())) OR 
  (has_role(auth.uid(), 'consultant'::app_role) AND (consultant_id = auth.uid()))
);