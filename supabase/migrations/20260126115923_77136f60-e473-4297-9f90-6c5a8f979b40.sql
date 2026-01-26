-- =====================================================
-- CORREÇÃO RLS: Permitir Transferência de Conversas
-- =====================================================

-- 1. REMOVER POLÍTICAS RESTRITIVAS DE UPDATE EM CONVERSATIONS
DROP POLICY IF EXISTS "sales_rep_can_update_assigned_conversations" ON conversations;
DROP POLICY IF EXISTS "support_agent_can_update_assigned_conversations" ON conversations;
DROP POLICY IF EXISTS "consultant_can_update_assigned_conversations" ON conversations;

-- 2. CRIAR POLÍTICA UNIFICADA PARA AGENTES TRANSFERIREM CONVERSAS
CREATE POLICY "agents_can_update_and_transfer_conversations" ON conversations
FOR UPDATE TO authenticated
USING (
  -- Admin/Manager: acesso total
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'general_manager') OR
  has_role(auth.uid(), 'cs_manager') OR
  has_role(auth.uid(), 'support_manager') OR
  -- Agentes: podem atualizar conversas atribuídas a eles OU do pool do departamento
  (has_role(auth.uid(), 'sales_rep') AND (
    assigned_to = auth.uid() OR 
    (assigned_to IS NULL AND department IN (SELECT id FROM departments WHERE name IN ('Comercial', 'Vendas')))
  )) OR
  (has_role(auth.uid(), 'support_agent') AND (
    assigned_to = auth.uid() OR 
    (assigned_to IS NULL AND department IN (SELECT id FROM departments WHERE name = 'Suporte'))
  )) OR
  (has_role(auth.uid(), 'consultant') AND assigned_to = auth.uid())
)
WITH CHECK (
  -- WITH CHECK apenas valida a role, permitindo mudar assigned_to para outro usuário
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'general_manager') OR
  has_role(auth.uid(), 'cs_manager') OR
  has_role(auth.uid(), 'support_manager') OR
  has_role(auth.uid(), 'sales_rep') OR
  has_role(auth.uid(), 'support_agent') OR
  has_role(auth.uid(), 'consultant')
);

-- 3. ATUALIZAR POLÍTICA INSERT EM INTERACTIONS PARA PERMITIR LOG DE TRANSFERÊNCIA
-- Usando last_message_at em vez de updated_at (que não existe em conversations)
DROP POLICY IF EXISTS "interactions_insert_policy" ON interactions;

CREATE POLICY "interactions_insert_policy" ON interactions
FOR INSERT TO authenticated
WITH CHECK (
  -- Managers têm acesso irrestrito
  has_role(auth.uid(), 'admin') OR 
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'cs_manager') OR
  has_role(auth.uid(), 'general_manager') OR
  has_role(auth.uid(), 'support_manager') OR
  has_role(auth.uid(), 'financial_manager') OR
  has_role(auth.uid(), 'support_agent') OR
  -- Sales rep: pode inserir para contatos/conversas onde está atribuído OU transferência recente
  (has_role(auth.uid(), 'sales_rep') AND (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = customer_id AND contacts.assigned_to = auth.uid()) OR
    EXISTS (SELECT 1 FROM conversations WHERE conversations.contact_id = customer_id AND (
      conversations.assigned_to = auth.uid() OR
      conversations.last_message_at > NOW() - INTERVAL '10 seconds'
    ))
  )) OR
  -- Consultant: pode inserir para contatos como consultor OU transferências recentes
  (has_role(auth.uid(), 'consultant') AND (
    EXISTS (SELECT 1 FROM contacts WHERE contacts.id = customer_id AND contacts.consultant_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM conversations WHERE conversations.contact_id = customer_id AND (
      conversations.assigned_to = auth.uid() OR
      conversations.last_message_at > NOW() - INTERVAL '10 seconds'
    ))
  )) OR
  -- User role
  (has_role(auth.uid(), 'user') AND EXISTS (
    SELECT 1 FROM conversations 
    WHERE conversations.contact_id = customer_id AND (
      conversations.assigned_to = auth.uid() OR
      conversations.department = (SELECT p.department FROM profiles p WHERE p.id = auth.uid())
    )
  ))
);