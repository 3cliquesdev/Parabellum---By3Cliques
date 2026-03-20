-- Migration: otp_verification_audit
-- Tabela imutável para auditoria granular de cada tentativa de verificação OTP

CREATE TABLE IF NOT EXISTS public.otp_verification_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  otp_reason TEXT,        -- 'withdrawal', 'login', etc.
  result TEXT NOT NULL,   -- 'code_sent', 'success', 'invalid_code', 'expired', 'rate_limited', 'max_attempts'
  attempt_number INT DEFAULT 1,
  channel TEXT DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Imutável: bloqueia UPDATE e DELETE
CREATE OR REPLACE RULE otp_audit_no_update AS ON UPDATE TO public.otp_verification_audit DO INSTEAD NOTHING;
CREATE OR REPLACE RULE otp_audit_no_delete AS ON DELETE TO public.otp_verification_audit DO INSTEAD NOTHING;

-- Índices para consultas de análise
CREATE INDEX IF NOT EXISTS idx_otp_audit_conversation ON public.otp_verification_audit(conversation_id);
CREATE INDEX IF NOT EXISTS idx_otp_audit_contact ON public.otp_verification_audit(contact_id);
CREATE INDEX IF NOT EXISTS idx_otp_audit_result ON public.otp_verification_audit(result);
CREATE INDEX IF NOT EXISTS idx_otp_audit_created_at ON public.otp_verification_audit(created_at DESC);

-- RLS
ALTER TABLE public.otp_verification_audit ENABLE ROW LEVEL SECURITY;

-- Apenas INSERT permitido para service_role / Edge Functions
CREATE POLICY "service_role_insert_otp_audit"
  ON public.otp_verification_audit FOR INSERT
  TO service_role WITH CHECK (true);

-- Admin e manager podem ver todos os logs
CREATE POLICY "admin_manager_select_otp_audit"
  ON public.otp_verification_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'manager')
    )
  );

COMMENT ON TABLE public.otp_verification_audit IS 'Auditoria imutável de todas as tentativas de verificação OTP (WhatsApp saque flow)';
