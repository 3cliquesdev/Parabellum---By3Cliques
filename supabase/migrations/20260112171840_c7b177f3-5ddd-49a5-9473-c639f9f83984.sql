-- Corrigir política de SELECT na tabela contacts
-- Permitir que sales_rep veja contatos vinculados aos deals dele

DROP POLICY IF EXISTS "role_based_select_contacts" ON contacts;

CREATE POLICY "role_based_select_contacts" ON contacts
FOR SELECT
USING (
  -- Admins e managers veem todos
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR 
  has_role(auth.uid(), 'cs_manager'::app_role) OR 
  has_role(auth.uid(), 'support_manager'::app_role) OR 
  has_role(auth.uid(), 'financial_manager'::app_role) OR 
  has_role(auth.uid(), 'financial_agent'::app_role) OR 
  has_role(auth.uid(), 'support_agent'::app_role) OR
  
  -- Sales rep pode ver:
  -- 1. Contatos diretamente atribuídos a ele
  -- 2. Contatos vinculados a deals atribuídos a ele
  (has_role(auth.uid(), 'sales_rep'::app_role) AND (
    assigned_to = auth.uid() OR
    id IN (
      SELECT contact_id FROM deals 
      WHERE deals.assigned_to = auth.uid() 
      AND contact_id IS NOT NULL
    )
  )) OR
  
  -- Consultant pode ver contatos onde é consultor
  (has_role(auth.uid(), 'consultant'::app_role) AND consultant_id = auth.uid())
);