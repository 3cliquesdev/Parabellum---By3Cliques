
-- Drop the existing select policies for contacts
DROP POLICY IF EXISTS "role_based_select_contacts" ON public.contacts;
DROP POLICY IF EXISTS "cs_manager_can_view_all_customers" ON public.contacts;
DROP POLICY IF EXISTS "financial_manager_can_view_contacts" ON public.contacts;

-- Create a unified select policy that includes all roles that need to view contacts
CREATE POLICY "role_based_select_contacts" ON public.contacts
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'sales_rep'::app_role) OR
  has_role(auth.uid(), 'consultant'::app_role) OR
  has_role(auth.uid(), 'support_agent'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'financial_manager'::app_role)
);
