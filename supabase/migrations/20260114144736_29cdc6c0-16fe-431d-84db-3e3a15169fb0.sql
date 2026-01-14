-- Ajustar policy de UPDATE para support_agent permitir transferir conversas do pool do Suporte
-- (conversas onde assigned_to IS NULL e department = Suporte)

DROP POLICY IF EXISTS support_agent_can_update_assigned_conversations ON public.conversations;

CREATE POLICY support_agent_can_update_assigned_conversations ON public.conversations 
FOR UPDATE TO authenticated 
USING (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND (
    (assigned_to = auth.uid()) 
    OR 
    (assigned_to IS NULL AND department = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a')
  )
) 
WITH CHECK (
  has_role(auth.uid(), 'support_agent'::app_role)
);