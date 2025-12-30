-- Corrigir RLS da tabela contacts para restringir sales_rep e consultant
-- Vendedores só verão contatos atribuídos a eles

DROP POLICY IF EXISTS role_based_select_contacts ON contacts;

CREATE POLICY role_based_select_contacts ON contacts
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR 
  has_role(auth.uid(), 'cs_manager'::app_role) OR 
  has_role(auth.uid(), 'support_manager'::app_role) OR 
  has_role(auth.uid(), 'financial_manager'::app_role) OR 
  has_role(auth.uid(), 'support_agent'::app_role) OR
  (has_role(auth.uid(), 'sales_rep'::app_role) AND assigned_to = auth.uid()) OR
  (has_role(auth.uid(), 'consultant'::app_role) AND consultant_id = auth.uid())
);