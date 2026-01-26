-- Remover política antiga restritiva
DROP POLICY IF EXISTS "admin_manager_can_manage_conversation_tags" ON public.conversation_tags;

-- Criar nova política incluindo todos os roles de gerência
CREATE POLICY "admin_manager_can_manage_conversation_tags"
ON public.conversation_tags
FOR ALL
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