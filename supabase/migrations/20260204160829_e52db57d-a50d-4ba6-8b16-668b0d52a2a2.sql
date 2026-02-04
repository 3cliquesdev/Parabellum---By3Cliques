-- Corrigir política de support_agent para UPDATE
-- Problema: WITH CHECK valida o NOVO estado, não o antigo
DROP POLICY IF EXISTS support_agent_can_update_tickets ON tickets;

-- Política expandida: support_agent pode atualizar se:
-- 1. Ticket atribuído a ele (antes OU depois)
-- 2. Ticket sem atribuição
-- 3. Ticket criado por ele
-- 4. Ticket do mesmo departamento (antes OU depois)
CREATE POLICY support_agent_can_update_tickets ON tickets
FOR UPDATE 
USING (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND (
    assigned_to = auth.uid() 
    OR assigned_to IS NULL 
    OR created_by = auth.uid()
    OR department_id = (SELECT department FROM profiles WHERE id = auth.uid())
  )
)
WITH CHECK (
  has_role(auth.uid(), 'support_agent'::app_role)
);

-- Também verificar a política de VIEW para garantir que ela pode ver tickets do dept
DROP POLICY IF EXISTS support_agent_can_view_tickets ON tickets;

CREATE POLICY support_agent_can_view_tickets ON tickets
FOR SELECT USING (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND (
    assigned_to = auth.uid() 
    OR assigned_to IS NULL 
    OR created_by = auth.uid()
    OR department_id = (SELECT department FROM profiles WHERE id = auth.uid())
  )
);