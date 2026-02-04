-- Dropar política restritiva atual de support_agent para UPDATE
DROP POLICY IF EXISTS support_agent_can_update_tickets ON tickets;

-- Criar política expandida: support_agent pode atualizar tickets do mesmo departamento
CREATE POLICY support_agent_can_update_tickets ON tickets
FOR UPDATE USING (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND (
    assigned_to = auth.uid() 
    OR assigned_to IS NULL 
    OR created_by = auth.uid()
    -- NOVO: permitir atualizar tickets do mesmo departamento
    OR department_id = (SELECT department FROM profiles WHERE id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND (
    assigned_to = auth.uid() 
    OR assigned_to IS NULL 
    OR created_by = auth.uid()
    OR department_id = (SELECT department FROM profiles WHERE id = auth.uid())
  )
);