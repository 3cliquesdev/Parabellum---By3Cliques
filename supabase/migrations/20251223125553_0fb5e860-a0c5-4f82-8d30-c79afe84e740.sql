-- Remover políticas de INSERT duplicadas/conflitantes
DROP POLICY IF EXISTS "authenticated_can_create_tickets" ON public.tickets;
DROP POLICY IF EXISTS "support_agent_can_insert_tickets" ON public.tickets;
DROP POLICY IF EXISTS "support_manager_can_insert_tickets" ON public.tickets;

-- Criar política única e clara para INSERT de tickets
CREATE POLICY "authenticated_users_can_create_tickets" 
ON public.tickets 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'support_agent'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role) OR
  has_role(auth.uid(), 'financial_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'sales_rep'::app_role)
);