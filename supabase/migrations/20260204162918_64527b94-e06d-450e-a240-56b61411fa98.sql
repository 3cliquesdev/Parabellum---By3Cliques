-- Atualizar política RLS para INSERT em messages
-- Permite que agentes do mesmo departamento possam enviar mensagens em conversas do departamento

DROP POLICY IF EXISTS role_based_insert_messages ON public.messages;

CREATE POLICY role_based_insert_messages ON public.messages
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin') 
  OR has_role(auth.uid(), 'manager')
  OR has_role(auth.uid(), 'general_manager')
  OR has_role(auth.uid(), 'support_manager')
  OR has_role(auth.uid(), 'cs_manager')
  OR has_role(auth.uid(), 'financial_manager')
  OR EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id 
    AND (
      c.assigned_to = auth.uid()                    -- Atribuída ao usuário
      OR c.assigned_to IS NULL                       -- Não atribuída (pool)
      OR c.department = (                            -- Mesmo departamento
        SELECT department FROM profiles WHERE id = auth.uid()
      )
    )
  )
);