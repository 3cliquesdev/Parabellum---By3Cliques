-- Adicionar novos tipos de interação para tickets na timeline do cliente
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'ticket_created';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'ticket_assigned';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'ticket_status_changed';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'ticket_transferred';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'ticket_resolved';
ALTER TYPE public.interaction_type ADD VALUE IF NOT EXISTS 'ticket_closed';

-- Criar tabela de stakeholders do ticket para rastrear todos os envolvidos
CREATE TABLE IF NOT EXISTS public.ticket_stakeholders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('creator', 'assignee', 'transferor', 'commenter')),
  added_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ticket_id, user_id, role)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_ticket_stakeholders_ticket_id ON public.ticket_stakeholders(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_stakeholders_user_id ON public.ticket_stakeholders(user_id);

-- Habilitar RLS
ALTER TABLE public.ticket_stakeholders ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Authenticated can read stakeholders"
ON public.ticket_stakeholders FOR SELECT
TO authenticated USING (true);

CREATE POLICY "Authenticated can insert stakeholders"
ON public.ticket_stakeholders FOR INSERT
TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update stakeholders"
ON public.ticket_stakeholders FOR UPDATE
TO authenticated USING (true) WITH CHECK (true);

-- Adicionar realtime para stakeholders
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_stakeholders;