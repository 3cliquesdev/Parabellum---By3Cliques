-- ===================================================================
-- FASE 1: CORRIGIR SEGURANÇA RLS - CONTROLE DE ACESSO POR ROLE
-- ===================================================================

-- 1. REMOVER POLICIES PERMISSIVAS INSEGURAS
-- -----------------------------------------------------------------

DROP POLICY IF EXISTS "Allow authenticated users full access to deals" ON public.deals;
DROP POLICY IF EXISTS "Allow authenticated users full access to contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow authenticated users full access to conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow authenticated users full access to messages" ON public.messages;
DROP POLICY IF EXISTS "Allow authenticated users full access to organizations" ON public.organizations;


-- 2. CRIAR POLICIES GRANULARES PARA TABELA: deals
-- -----------------------------------------------------------------

-- SELECT: Admin/Manager veem tudo, Sales Rep vê só os seus
CREATE POLICY "role_based_select_deals" ON public.deals
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND assigned_to = auth.uid())
  );

-- INSERT: Todos podem criar, mas sales_rep só pode atribuir a si mesmo
CREATE POLICY "role_based_insert_deals" ON public.deals
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND (assigned_to = auth.uid() OR assigned_to IS NULL))
  );

-- UPDATE: Só pode editar os próprios deals (ou admin/manager editam tudo)
CREATE POLICY "role_based_update_deals" ON public.deals
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND assigned_to = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND (assigned_to = auth.uid() OR assigned_to IS NULL))
  );

-- DELETE: Apenas admin/manager
CREATE POLICY "role_based_delete_deals" ON public.deals
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );


-- 3. CRIAR POLICIES GRANULARES PARA TABELA: contacts
-- -----------------------------------------------------------------

-- SELECT: Admin/Manager veem tudo, Sales Rep vê só os seus
CREATE POLICY "role_based_select_contacts" ON public.contacts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND assigned_to = auth.uid())
  );

-- INSERT: Todos podem criar, mas sales_rep só pode atribuir a si mesmo
CREATE POLICY "role_based_insert_contacts" ON public.contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND (assigned_to = auth.uid() OR assigned_to IS NULL))
  );

-- UPDATE: Só pode editar os próprios contatos
CREATE POLICY "role_based_update_contacts" ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND assigned_to = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND (assigned_to = auth.uid() OR assigned_to IS NULL))
  );

-- DELETE: Apenas admin/manager
CREATE POLICY "role_based_delete_contacts" ON public.contacts
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );


-- 4. CRIAR POLICIES GRANULARES PARA TABELA: conversations
-- -----------------------------------------------------------------

-- SELECT: Conversas seguem o assigned_to
CREATE POLICY "role_based_select_conversations" ON public.conversations
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND assigned_to = auth.uid())
  );

-- INSERT: Todos podem criar
CREATE POLICY "role_based_insert_conversations" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND (assigned_to = auth.uid() OR assigned_to IS NULL))
  );

-- UPDATE: Só pode editar conversas atribuídas a si
CREATE POLICY "role_based_update_conversations" ON public.conversations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND assigned_to = auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    (public.has_role(auth.uid(), 'sales_rep') AND (assigned_to = auth.uid() OR assigned_to IS NULL))
  );

-- DELETE: Apenas admin/manager
CREATE POLICY "role_based_delete_conversations" ON public.conversations
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );


-- 5. CRIAR POLICIES GRANULARES PARA TABELA: messages
-- -----------------------------------------------------------------
-- Messages requerem JOIN com conversations para verificar acesso

-- SELECT: Pode ver mensagens de conversas que tem acesso
CREATE POLICY "role_based_select_messages" ON public.messages
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id 
      AND (c.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    )
  );

-- INSERT: Pode criar mensagens em conversas que tem acesso
CREATE POLICY "role_based_insert_messages" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id 
      AND (c.assigned_to = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
    )
  );

-- UPDATE: Pode editar mensagens de conversas que tem acesso
CREATE POLICY "role_based_update_messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager') OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id 
      AND c.assigned_to = auth.uid()
    )
  );

-- DELETE: Apenas admin/manager
CREATE POLICY "role_based_delete_messages" ON public.messages
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );


-- 6. CRIAR POLICIES GRANULARES PARA TABELA: organizations
-- -----------------------------------------------------------------

-- SELECT: Todos autenticados podem visualizar organizações
CREATE POLICY "all_authenticated_view_organizations" ON public.organizations
  FOR SELECT TO authenticated
  USING (true);

-- INSERT: Apenas admin/manager podem criar
CREATE POLICY "admin_manager_create_organizations" ON public.organizations
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- UPDATE: Apenas admin/manager podem editar
CREATE POLICY "admin_manager_update_organizations" ON public.organizations
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );

-- DELETE: Apenas admin/manager podem deletar
CREATE POLICY "admin_manager_delete_organizations" ON public.organizations
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'manager')
  );


-- ===================================================================
-- MIGRATION COMPLETA - SEGURANÇA RLS IMPLEMENTADA
-- ===================================================================