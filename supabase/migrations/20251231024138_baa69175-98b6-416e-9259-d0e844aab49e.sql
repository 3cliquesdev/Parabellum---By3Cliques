-- =====================================================
-- FASE 1: Correções Críticas de Segurança
-- =====================================================

-- 1.1 Adicionar RLS policies na tabela ai_response_cache
-- Permitir leitura para usuários autenticados
CREATE POLICY "authenticated_can_read_cache" ON public.ai_response_cache
  FOR SELECT TO authenticated USING (true);

-- Permitir inserção para admins e managers
CREATE POLICY "admins_managers_can_insert_cache" ON public.ai_response_cache
  FOR INSERT TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role) OR 
    public.has_role(auth.uid(), 'manager'::app_role)
  );

-- Permitir deleção apenas para admins
CREATE POLICY "admins_can_delete_cache" ON public.ai_response_cache
  FOR DELETE TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
  );

-- =====================================================
-- FASE 2: Índices para Performance
-- =====================================================

-- Índice para form_submissions por form_id (muito usado em queries)
CREATE INDEX IF NOT EXISTS idx_form_submissions_form_id 
  ON public.form_submissions(form_id);

-- Índice composto para tickets (filtros comuns)
CREATE INDEX IF NOT EXISTS idx_tickets_status_assigned 
  ON public.tickets(status, assigned_to);

-- Índice para contacts por consultant e status (distribuição de clientes)
CREATE INDEX IF NOT EXISTS idx_contacts_consultant_status 
  ON public.contacts(consultant_id, status);

-- Índice para conversations por status e assigned_to (inbox de atendentes)
CREATE INDEX IF NOT EXISTS idx_conversations_status_assigned 
  ON public.conversations(status, assigned_to);

-- Índice para messages por conversation_id e created_at (timeline de chat)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
  ON public.messages(conversation_id, created_at DESC);

-- Índice para activities por assigned_to e completed (tarefas pendentes)
CREATE INDEX IF NOT EXISTS idx_activities_assigned_completed 
  ON public.activities(assigned_to, completed);

-- Índice para deals por stage_id e status (kanban pipeline)
CREATE INDEX IF NOT EXISTS idx_deals_stage_status 
  ON public.deals(stage_id, status);