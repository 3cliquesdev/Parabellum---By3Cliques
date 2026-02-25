-- Fix paridade: update admin-only policy to include all manager roles
DROP POLICY IF EXISTS "admins_can_manage_configurations" ON public.system_configurations;

CREATE POLICY "managers_can_manage_configurations"
ON public.system_configurations
FOR ALL
TO authenticated
USING (public.is_manager_or_admin(auth.uid()))
WITH CHECK (public.is_manager_or_admin(auth.uid()));

-- Seed ticket email configs (upsert to avoid duplicates)
INSERT INTO public.system_configurations (key, value, category, description)
VALUES
  ('ticket_email_customer_created', 'true', 'ticket_email', 'Email ao cliente na criação do ticket'),
  ('ticket_email_customer_resolved', 'true', 'ticket_email', 'Email ao cliente na resolução do ticket'),
  ('ticket_email_customer_comment', 'true', 'ticket_email', 'Email ao cliente em comentário público')
ON CONFLICT (key) DO NOTHING;