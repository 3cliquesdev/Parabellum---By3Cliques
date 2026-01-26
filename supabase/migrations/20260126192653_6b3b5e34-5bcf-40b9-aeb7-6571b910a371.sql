-- Remover política antiga restritiva
DROP POLICY IF EXISTS "Admins and managers can manage chat flows" ON public.chat_flows;

-- Criar nova política incluindo todos os roles de gerência
CREATE POLICY "Admins and managers can manage chat flows"
ON public.chat_flows
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'manager', 'general_manager', 'support_manager')
  )
);