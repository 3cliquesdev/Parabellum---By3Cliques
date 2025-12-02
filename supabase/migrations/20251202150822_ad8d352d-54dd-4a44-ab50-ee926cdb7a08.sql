-- Drop the old admin-only policy
DROP POLICY IF EXISTS admins_can_manage_stages ON stages;

-- Create new policy including all management roles
CREATE POLICY managers_can_manage_stages ON stages
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'support_manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'general_manager'::app_role) OR
    has_role(auth.uid(), 'support_manager'::app_role)
  );