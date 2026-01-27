-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Admin and Manager can manage playbooks" ON onboarding_playbooks;

-- Recreate with all management roles included
CREATE POLICY "Admins and managers can manage playbooks"
ON onboarding_playbooks
FOR ALL
TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'financial_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'financial_manager'::app_role)
);