-- Tabela para tracking de eventos de email (Resend webhooks)
CREATE TABLE public.email_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id TEXT NOT NULL,
  customer_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  playbook_execution_id UUID REFERENCES public.playbook_executions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_email_tracking_email_id ON public.email_tracking_events(email_id);
CREATE INDEX idx_email_tracking_customer ON public.email_tracking_events(customer_id);
CREATE INDEX idx_email_tracking_event ON public.email_tracking_events(event_type);
CREATE INDEX idx_email_tracking_playbook ON public.email_tracking_events(playbook_execution_id);
CREATE INDEX idx_email_tracking_created ON public.email_tracking_events(created_at DESC);

-- RLS
ALTER TABLE public.email_tracking_events ENABLE ROW LEVEL SECURITY;

-- Admin/Manager podem ver todos os eventos
CREATE POLICY "admin_manager_view_email_tracking" ON public.email_tracking_events
FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role)
);

-- Sistema pode inserir eventos (via service role)
CREATE POLICY "system_insert_email_tracking" ON public.email_tracking_events
FOR INSERT WITH CHECK (true);

-- Comentário
COMMENT ON TABLE public.email_tracking_events IS 'Tracking de eventos de email do Resend (sent, delivered, opened, clicked, bounced)';