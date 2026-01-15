-- Drop existing policy
DROP POLICY IF EXISTS "role_based_select_contacts" ON public.contacts;

-- Recreate with consultant full access to view all clients
CREATE POLICY "role_based_select_contacts"
ON public.contacts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR 
  has_role(auth.uid(), 'cs_manager'::app_role) OR 
  has_role(auth.uid(), 'support_manager'::app_role) OR 
  has_role(auth.uid(), 'financial_manager'::app_role) OR 
  has_role(auth.uid(), 'financial_agent'::app_role) OR 
  has_role(auth.uid(), 'support_agent'::app_role) OR 
  has_role(auth.uid(), 'ecommerce_analyst'::app_role) OR
  -- CONSULTANT: Agora pode ver TODOS os clientes para criar tickets
  has_role(auth.uid(), 'consultant'::app_role) OR
  -- sales_rep mantém restrição atual
  (has_role(auth.uid(), 'sales_rep'::app_role) AND (
    (assigned_to = auth.uid()) OR 
    (id IN (SELECT deals.contact_id FROM deals WHERE deals.assigned_to = auth.uid() AND deals.contact_id IS NOT NULL)) OR 
    (id IN (SELECT conversations.contact_id FROM conversations WHERE conversations.assigned_to = auth.uid()))
  )) OR
  -- user mantém restrição atual
  (has_role(auth.uid(), 'user'::app_role) AND (
    id IN (SELECT conversations.contact_id FROM conversations WHERE 
      conversations.assigned_to = auth.uid() OR 
      conversations.department = (SELECT p.department FROM profiles p WHERE p.id = auth.uid())
    )
  ))
);