
-- ================================================
-- FASE 1: CORRIGIR POLÍTICAS RLS CRÍTICAS
-- ================================================

-- 1.1 - playbook_executions: CS Manager e General Manager podem ver todas execuções
CREATE POLICY "cs_gm_can_view_all_executions" ON public.playbook_executions
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'cs_manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
);

-- 1.2 - profiles: Todos gestores podem ver todos os perfis de funcionários
CREATE POLICY "management_roles_can_view_all_profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'cs_manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'support_manager'::app_role) OR
  public.has_role(auth.uid(), 'financial_manager'::app_role)
);

-- 1.3 - activities: Corrigir para incluir todas roles de gestão
DROP POLICY IF EXISTS "role_based_select_activities" ON public.activities;
CREATE POLICY "role_based_select_activities" ON public.activities
FOR SELECT TO public
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'cs_manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'support_manager'::app_role) OR
  public.has_role(auth.uid(), 'financial_manager'::app_role) OR
  (public.has_role(auth.uid(), 'sales_rep'::app_role) AND (assigned_to = auth.uid()))
);

-- 1.4 - messages: Gestores podem ver todas mensagens do inbox
DROP POLICY IF EXISTS "role_based_select_messages" ON public.messages;
CREATE POLICY "role_based_select_messages" ON public.messages
FOR SELECT TO public
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'cs_manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'support_manager'::app_role) OR
  public.has_role(auth.uid(), 'financial_manager'::app_role) OR
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = messages.conversation_id 
    AND c.assigned_to = auth.uid()
  )
);

-- 1.5 - conversations: General Manager pode ver todas conversas
CREATE POLICY "general_manager_can_view_all_conversations" ON public.conversations
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'general_manager'::app_role));

CREATE POLICY "general_manager_can_update_conversations" ON public.conversations
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'general_manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'general_manager'::app_role));

-- 1.6 - customer_journey_steps: General Manager pode atualizar
CREATE POLICY "general_manager_can_update_journey_steps" ON public.customer_journey_steps
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'general_manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'general_manager'::app_role));

-- 1.7 - contacts: Financial Manager precisa ver contatos
CREATE POLICY "financial_manager_can_view_contacts" ON public.contacts
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'financial_manager'::app_role));

-- 1.8 - deals: Financial Manager precisa ver deals
CREATE POLICY "financial_manager_can_view_deals" ON public.deals
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'financial_manager'::app_role));

-- 1.9 - tickets: Gestores podem ver todos os tickets
CREATE POLICY "management_can_view_all_tickets" ON public.tickets
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'cs_manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'financial_manager'::app_role)
);

-- 1.10 - quotes: Financial Manager pode ver e criar cotações
CREATE POLICY "financial_manager_can_view_quotes" ON public.quotes
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'financial_manager'::app_role));

CREATE POLICY "financial_manager_can_manage_quotes" ON public.quotes
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'financial_manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'financial_manager'::app_role));

-- ================================================
-- FASE 2: HABILITAR PERMISSÕES EM MASSA
-- ================================================

-- 2.1 - financial_manager: Acesso a dados financeiros essenciais
UPDATE public.role_permissions SET enabled = true
WHERE role = 'financial_manager'
AND permission_key IN (
  'contacts.view', 'contacts.edit',
  'deals.view_all', 'deals.filter_by_rep',
  'analytics.view', 'analytics.export', 'analytics.financial',
  'tickets.view', 'tickets.create',
  'inbox.access', 'inbox.close',
  'quotes.view', 'quotes.create', 'quotes.edit',
  'cadastros.view_tags', 'cadastros.view_products', 'cadastros.view_departments'
);

-- 2.2 - support_manager: Acesso completo ao time de suporte
UPDATE public.role_permissions SET enabled = true
WHERE role = 'support_manager'
AND permission_key IN (
  'contacts.view', 'contacts.edit',
  'analytics.view', 'analytics.export',
  'automations.view', 'automations.create', 'automations.edit',
  'playbooks.view', 'playbooks.view_executions',
  'cadastros.view_tags', 'cadastros.view_products', 'cadastros.view_departments',
  'users.view',
  'tickets.view', 'tickets.create', 'tickets.update', 'tickets.delete',
  'inbox.access', 'inbox.close', 'inbox.transfer'
);

-- 2.3 - cs_manager: Acesso ampliado para gestão de CS
UPDATE public.role_permissions SET enabled = true
WHERE role = 'cs_manager'
AND permission_key IN (
  'audit.view_logs',
  'users.view',
  'contacts.delete', 'contacts.import', 'contacts.export',
  'quotes.view', 'quotes.create', 'quotes.edit',
  'deals.view_all', 'deals.filter_by_rep',
  'playbooks.view', 'playbooks.create', 'playbooks.edit', 'playbooks.view_executions',
  'automations.view',
  'cadastros.view_tags', 'cadastros.view_products', 'cadastros.view_departments'
);

-- 2.4 - manager: Garantir acesso completo
UPDATE public.role_permissions SET enabled = true
WHERE role = 'manager';
