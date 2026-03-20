-- Migration: saque_operation_logs
-- Tabela imutável para auditoria granular de cada etapa do fluxo de saque

CREATE TABLE IF NOT EXISTS public.saque_operation_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  step TEXT NOT NULL,         -- 'intent_detected', 'otp_sent', 'otp_validated', 'data_collected', 'ticket_created', 'conversation_closed', 'problem_reported'
  status TEXT NOT NULL,       -- 'success', 'failure', 'pending'
  pix_key_type TEXT,          -- 'cpf', 'email', 'phone', 'random' (sem valor real — sem PII)
  amount TEXT,                -- valor solicitado (ex: '250.00', 'valor total')
  error_message TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Imutável: bloqueia UPDATE e DELETE
CREATE OR REPLACE RULE saque_log_no_update AS ON UPDATE TO public.saque_operation_logs DO INSTEAD NOTHING;
CREATE OR REPLACE RULE saque_log_no_delete AS ON DELETE TO public.saque_operation_logs DO INSTEAD NOTHING;

-- Índices para consultas de análise
CREATE INDEX IF NOT EXISTS idx_saque_log_conversation ON public.saque_operation_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_saque_log_contact ON public.saque_operation_logs(contact_id);
CREATE INDEX IF NOT EXISTS idx_saque_log_ticket ON public.saque_operation_logs(ticket_id);
CREATE INDEX IF NOT EXISTS idx_saque_log_step ON public.saque_operation_logs(step);
CREATE INDEX IF NOT EXISTS idx_saque_log_status ON public.saque_operation_logs(status);
CREATE INDEX IF NOT EXISTS idx_saque_log_created_at ON public.saque_operation_logs(created_at DESC);

-- RLS
ALTER TABLE public.saque_operation_logs ENABLE ROW LEVEL SECURITY;

-- Apenas INSERT permitido para service_role / Edge Functions
CREATE POLICY "service_role_insert_saque_log"
  ON public.saque_operation_logs FOR INSERT
  TO service_role WITH CHECK (true);

-- Admin e manager podem ver todos os logs
CREATE POLICY "admin_manager_select_saque_log"
  ON public.saque_operation_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
    )
  );

COMMENT ON TABLE public.saque_operation_logs IS 'Auditoria imutável de cada etapa do fluxo de saque (withdrawal) via WhatsApp';
