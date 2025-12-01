-- ====================================
-- SISTEMA DE CANAIS DE ATENDIMENTO
-- ====================================

-- Tabela de canais de suporte
CREATE TABLE IF NOT EXISTS public.support_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Dados iniciais dos canais
INSERT INTO public.support_channels (name, description, color) VALUES
  ('Híbrido', 'Operação Híbrida (Nacional + Internacional)', '#8B5CF6'),
  ('Nacional', 'Operação 100% Nacional', '#22C55E'),
  ('Internacional', 'Operação 100% Internacional', '#F59E0B');

-- Tabela N:N agente-canais
CREATE TABLE IF NOT EXISTS public.agent_support_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel_id UUID NOT NULL REFERENCES public.support_channels(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, channel_id)
);

-- Adicionar support_channel_id em products
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS support_channel_id UUID REFERENCES public.support_channels(id);

-- Adicionar support_channel_id em contacts
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS support_channel_id UUID REFERENCES public.support_channels(id);

-- Adicionar support_channel_id em conversations
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS support_channel_id UUID REFERENCES public.support_channels(id);

-- ====================================
-- RLS POLICIES
-- ====================================

-- Support Channels: Todos podem visualizar, admin/manager podem gerenciar
ALTER TABLE public.support_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_can_view_support_channels"
  ON public.support_channels FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admin_manager_can_manage_support_channels"
  ON public.support_channels FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Agent Support Channels: Admin/Manager gerenciam, agentes veem os próprios
ALTER TABLE public.agent_support_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_can_view_own_channels"
  ON public.agent_support_channels FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "admin_manager_can_view_all_agent_channels"
  ON public.agent_support_channels FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'support_manager'::app_role)
  );

CREATE POLICY "admin_manager_can_manage_agent_channels"
  ON public.agent_support_channels FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'support_manager'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR
    has_role(auth.uid(), 'support_manager'::app_role)
  );

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_agent_support_channels_profile 
  ON public.agent_support_channels(profile_id);

CREATE INDEX IF NOT EXISTS idx_agent_support_channels_channel 
  ON public.agent_support_channels(channel_id);

CREATE INDEX IF NOT EXISTS idx_products_support_channel 
  ON public.products(support_channel_id);

CREATE INDEX IF NOT EXISTS idx_contacts_support_channel 
  ON public.contacts(support_channel_id);

CREATE INDEX IF NOT EXISTS idx_conversations_support_channel 
  ON public.conversations(support_channel_id);