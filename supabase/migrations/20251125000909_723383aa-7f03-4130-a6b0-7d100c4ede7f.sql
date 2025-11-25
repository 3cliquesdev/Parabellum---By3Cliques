-- FASE 1: Preparação do Schema de Dados - Módulo de Suporte

-- 1A - Expandir Tabela contacts com dados de endereço e pessoais
ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip_code TEXT,
  ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Criar índice para CEP (facilita buscas futuras)
CREATE INDEX IF NOT EXISTS idx_contacts_zip_code ON public.contacts(zip_code);

-- 1B - Criar ENUMs para Tickets
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');

-- Criar Tabela tickets
CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  priority ticket_priority NOT NULL DEFAULT 'medium',
  status ticket_status NOT NULL DEFAULT 'open',
  customer_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE NOT NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  attachment_url TEXT
);

-- Índices para performance
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_assigned_to ON public.tickets(assigned_to);
CREATE INDEX idx_tickets_customer_id ON public.tickets(customer_id);

-- Trigger para updated_at
CREATE TRIGGER update_tickets_updated_at 
  BEFORE UPDATE ON public.tickets 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies para tickets
-- Admin/Manager veem todos os tickets, sales_rep vê apenas assigned
CREATE POLICY "role_based_select_tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    (has_role(auth.uid(), 'sales_rep'::app_role) AND assigned_to = auth.uid())
  );

-- Authenticated users podem criar tickets
CREATE POLICY "authenticated_can_create_tickets" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Público pode criar tickets via edge function (sem auth)
CREATE POLICY "public_can_create_tickets" ON public.tickets
  FOR INSERT TO anon
  WITH CHECK (true);

-- Atualização apenas por admin/manager/assigned
CREATE POLICY "role_based_update_tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    (assigned_to = auth.uid())
  );

-- Delete apenas admin/manager
CREATE POLICY "role_based_delete_tickets" ON public.tickets
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );

-- 1C - Criar Tabela ticket_comments
CREATE TABLE public.ticket_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);

-- Habilitar RLS
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies para comments (mesmas regras dos tickets)
CREATE POLICY "role_based_select_comments" ON public.ticket_comments
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role) OR 
    EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE t.id = ticket_comments.ticket_id 
      AND t.assigned_to = auth.uid()
    )
  );

CREATE POLICY "authenticated_can_create_comments" ON public.ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Admin/manager podem deletar comments
CREATE POLICY "role_based_delete_comments" ON public.ticket_comments
  FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR 
    has_role(auth.uid(), 'manager'::app_role)
  );