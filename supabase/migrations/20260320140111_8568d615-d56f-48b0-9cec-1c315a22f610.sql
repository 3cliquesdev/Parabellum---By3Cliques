CREATE TABLE IF NOT EXISTS public.otp_verification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text,
  contact_id uuid REFERENCES public.contacts(id),
  otp_reason text,
  result text NOT NULL,
  attempt_number integer DEFAULT 1,
  channel text DEFAULT 'whatsapp',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.otp_verification_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on otp_verification_audit"
  ON public.otp_verification_audit
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated read otp_verification_audit"
  ON public.otp_verification_audit
  FOR SELECT
  TO authenticated
  USING (true);