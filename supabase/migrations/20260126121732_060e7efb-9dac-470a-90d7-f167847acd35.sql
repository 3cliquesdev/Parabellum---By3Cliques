-- Correção definitiva das políticas RLS para transferência de conversas
-- Executado após deadlock temporário

-- 1. Remover política conflitante
DROP POLICY IF EXISTS "user_can_update_department_conversations" ON conversations;

-- 2. Recriar política unificada
DROP POLICY IF EXISTS "agents_can_update_and_transfer_conversations" ON conversations;

CREATE POLICY "agents_can_update_and_transfer_conversations" ON conversations
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'general_manager') OR
  has_role(auth.uid(), 'cs_manager') OR
  has_role(auth.uid(), 'support_manager') OR
  (has_role(auth.uid(), 'sales_rep') AND (
    assigned_to = auth.uid() OR 
    (assigned_to IS NULL AND department IN (
      SELECT id FROM departments WHERE name IN ('Comercial', 'Vendas')
    ))
  )) OR
  (has_role(auth.uid(), 'support_agent') AND (
    assigned_to = auth.uid() OR 
    (assigned_to IS NULL AND department IN (
      SELECT id FROM departments WHERE name = 'Suporte'
    ))
  )) OR
  (has_role(auth.uid(), 'consultant') AND assigned_to = auth.uid()) OR
  (has_role(auth.uid(), 'user') AND (
    assigned_to = auth.uid() OR 
    (assigned_to IS NULL AND department = (
      SELECT p.department FROM profiles p WHERE p.id = auth.uid()
    ))
  ))
)
WITH CHECK (
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'general_manager') OR
  has_role(auth.uid(), 'cs_manager') OR
  has_role(auth.uid(), 'support_manager') OR
  has_role(auth.uid(), 'sales_rep') OR
  has_role(auth.uid(), 'support_agent') OR
  has_role(auth.uid(), 'consultant') OR
  has_role(auth.uid(), 'user')
);