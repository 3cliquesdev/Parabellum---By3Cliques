-- =====================================================
-- ADICIONAR ROLE 'user' NAS RLS POLICIES
-- Para permitir que usuários genéricos vejam contatos,
-- transfiram conversas e registrem interações
-- =====================================================

-- PARTE 1: Policies para conversations (SELECT e UPDATE)
DROP POLICY IF EXISTS user_can_view_department_conversations ON conversations;
DROP POLICY IF EXISTS user_can_update_department_conversations ON conversations;

-- Permitir que role 'user' veja conversas do seu departamento
CREATE POLICY "user_can_view_department_conversations" ON conversations
FOR SELECT USING (
  has_role(auth.uid(), 'user'::app_role) AND (
    assigned_to = auth.uid() OR 
    (department = (
      SELECT p.department::uuid FROM profiles p WHERE p.id = auth.uid()
    ))
  )
);

-- Permitir que role 'user' atualize conversas do seu departamento
CREATE POLICY "user_can_update_department_conversations" ON conversations
FOR UPDATE USING (
  has_role(auth.uid(), 'user'::app_role) AND (
    assigned_to = auth.uid() OR 
    (assigned_to IS NULL AND department = (
      SELECT p.department::uuid FROM profiles p WHERE p.id = auth.uid()
    ))
  )
) WITH CHECK (has_role(auth.uid(), 'user'::app_role));

-- PARTE 2: Atualizar RLS de contacts para incluir role 'user'
DROP POLICY IF EXISTS role_based_select_contacts ON contacts;

CREATE POLICY "role_based_select_contacts" ON contacts
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR 
  has_role(auth.uid(), 'support_manager'::app_role) OR
  has_role(auth.uid(), 'financial_manager'::app_role) OR
  has_role(auth.uid(), 'financial_agent'::app_role) OR
  has_role(auth.uid(), 'support_agent'::app_role) OR
  -- Sales rep: ver contatos assigned OU com deals OU de conversas assigned
  (has_role(auth.uid(), 'sales_rep'::app_role) AND (
    assigned_to = auth.uid() OR 
    id IN (SELECT contact_id FROM deals WHERE assigned_to = auth.uid() AND contact_id IS NOT NULL) OR
    id IN (SELECT contact_id FROM conversations WHERE assigned_to = auth.uid())
  )) OR
  -- Role 'user': pode ver contatos de conversas do seu departamento
  (has_role(auth.uid(), 'user'::app_role) AND (
    id IN (SELECT contact_id FROM conversations WHERE 
      assigned_to = auth.uid() OR
      department = (SELECT p.department::uuid FROM profiles p WHERE p.id = auth.uid())
    )
  )) OR
  -- Consultant
  (has_role(auth.uid(), 'consultant'::app_role) AND consultant_id = auth.uid())
);

-- PARTE 3: Atualizar RLS de inbox_view para incluir role 'user'
DROP POLICY IF EXISTS user_view_department_inbox ON inbox_view;

CREATE POLICY "user_view_department_inbox" ON inbox_view
FOR SELECT USING (
  has_role(auth.uid(), 'user'::app_role) AND (
    assigned_to = auth.uid() OR 
    (assigned_to IS NULL AND department = (
      SELECT p.department::uuid FROM profiles p WHERE p.id = auth.uid()
    ))
  )
);

-- PARTE 4: Atualizar RLS de interactions para incluir role 'user'
DROP POLICY IF EXISTS interactions_insert_policy ON interactions;

CREATE POLICY "interactions_insert_policy" ON interactions
FOR INSERT WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR 
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role) OR
  has_role(auth.uid(), 'financial_manager'::app_role) OR
  has_role(auth.uid(), 'support_agent'::app_role) OR
  -- Sales rep
  (has_role(auth.uid(), 'sales_rep'::app_role) AND (
    EXISTS (SELECT 1 FROM contacts WHERE id = interactions.customer_id AND assigned_to = auth.uid()) OR
    EXISTS (SELECT 1 FROM conversations WHERE contact_id = interactions.customer_id AND assigned_to = auth.uid())
  )) OR
  -- Role 'user': pode inserir interações para contatos de conversas que tem acesso
  (has_role(auth.uid(), 'user'::app_role) AND (
    EXISTS (SELECT 1 FROM conversations WHERE contact_id = interactions.customer_id AND (
      assigned_to = auth.uid() OR
      department = (SELECT p.department::uuid FROM profiles p WHERE p.id = auth.uid())
    ))
  )) OR
  -- Consultant
  (has_role(auth.uid(), 'consultant'::app_role) AND 
    EXISTS (SELECT 1 FROM contacts WHERE id = interactions.customer_id AND consultant_id = auth.uid()))
);