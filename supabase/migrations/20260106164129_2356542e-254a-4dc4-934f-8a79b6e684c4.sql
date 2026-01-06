-- Create ticket_statuses table for dynamic status management
CREATE TABLE public.ticket_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6B7280',
  icon TEXT DEFAULT 'circle',
  is_active BOOLEAN DEFAULT true,
  is_archived_status BOOLEAN DEFAULT false,
  is_final_status BOOLEAN DEFAULT false,
  display_order INTEGER NOT NULL DEFAULT 0,
  send_email_notification BOOLEAN DEFAULT false,
  send_whatsapp_notification BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_statuses ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read statuses
CREATE POLICY "Anyone can view ticket statuses"
ON public.ticket_statuses FOR SELECT
USING (true);

-- Only admins/managers can modify statuses (using user_roles table)
CREATE POLICY "Admins can manage ticket statuses"
ON public.ticket_statuses FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager')
  )
);

-- Create indexes
CREATE INDEX idx_ticket_statuses_active ON ticket_statuses(is_active);
CREATE INDEX idx_ticket_statuses_order ON ticket_statuses(display_order);
CREATE INDEX idx_ticket_statuses_name ON ticket_statuses(name);

-- Insert default statuses based on current ENUM values
INSERT INTO public.ticket_statuses (name, label, description, color, icon, is_active, is_archived_status, is_final_status, display_order, send_email_notification) VALUES
  ('open', 'Aberto', 'Ticket recém criado aguardando atendimento', '#3B82F6', 'inbox', true, false, false, 1, false),
  ('in_progress', 'Em Andamento', 'Ticket sendo trabalhado por um agente', '#F97316', 'clock', true, false, false, 2, true),
  ('waiting_customer', 'Aguardando Cliente', 'Aguardando resposta ou ação do cliente', '#EAB308', 'alert-circle', true, false, false, 3, true),
  ('resolved', 'Resolvido', 'Problema resolvido, aguardando confirmação', '#22C55E', 'check-circle', true, true, false, 4, true),
  ('closed', 'Fechado', 'Ticket encerrado definitivamente', '#6B7280', 'x-circle', true, true, true, 5, true);

-- Create trigger for updated_at
CREATE TRIGGER update_ticket_statuses_updated_at
  BEFORE UPDATE ON public.ticket_statuses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();