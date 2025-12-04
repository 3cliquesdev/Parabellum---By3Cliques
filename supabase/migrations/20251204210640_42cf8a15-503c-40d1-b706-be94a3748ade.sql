-- Drop existing INSERT policy
DROP POLICY IF EXISTS "admins_can_insert_forms" ON public.forms;

-- Create new INSERT policy with expanded roles (admin, manager, general_manager)
CREATE POLICY "admins_managers_can_insert_forms" 
ON public.forms 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager', 'general_manager')
  )
);

-- Also update UPDATE policy to include managers
DROP POLICY IF EXISTS "admins_can_update_forms" ON public.forms;

CREATE POLICY "admins_managers_can_update_forms" 
ON public.forms 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager', 'general_manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager', 'general_manager')
  )
);

-- Update DELETE policy too
DROP POLICY IF EXISTS "admins_can_delete_forms" ON public.forms;

CREATE POLICY "admins_managers_can_delete_forms" 
ON public.forms 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager', 'general_manager')
  )
);