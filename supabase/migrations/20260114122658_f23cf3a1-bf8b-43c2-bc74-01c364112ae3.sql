-- Corrigir RLS para Transferência de Conversas

-- Dropar policy atual restritiva do support_agent (pode ter sido dropada no primeiro attempt)
DROP POLICY IF EXISTS "support_agent_can_update_assigned_conversations" ON conversations;

-- Nova policy que permite support_agent transferir conversas
CREATE POLICY "support_agent_can_update_assigned_conversations" ON conversations
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role) AND assigned_to = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'support_agent'::app_role)
);

-- Adicionar Policy de UPDATE para sales_rep
DROP POLICY IF EXISTS "sales_rep_can_update_assigned_conversations" ON conversations;

CREATE POLICY "sales_rep_can_update_assigned_conversations" ON conversations
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'sales_rep'::app_role) 
  AND (assigned_to = auth.uid() OR assigned_to IS NULL)
)
WITH CHECK (
  has_role(auth.uid(), 'sales_rep'::app_role)
);

-- Adicionar Policy de UPDATE para consultant
DROP POLICY IF EXISTS "consultant_can_update_assigned_conversations" ON conversations;

CREATE POLICY "consultant_can_update_assigned_conversations" ON conversations
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'consultant'::app_role) AND assigned_to = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'consultant'::app_role)
);