-- Dropar e recriar politica com WITH CHECK para corrigir toggle ativar/desativar
DROP POLICY IF EXISTS "Admins and managers can manage chat flows" ON chat_flows;

CREATE POLICY "Admins and managers can manage chat flows"
ON chat_flows
FOR ALL
TO public
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager', 'general_manager', 'support_manager', 'cs_manager', 'financial_manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager', 'general_manager', 'support_manager', 'cs_manager', 'financial_manager')
  )
);