CREATE TABLE IF NOT EXISTS public.saque_operation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id text,
  contact_id uuid REFERENCES public.contacts(id),
  ticket_id uuid,
  step text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  pix_key_type text,
  amount text,
  error_message text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.saque_operation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on saque_operation_logs"
  ON public.saque_operation_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated read saque_operation_logs"
  ON public.saque_operation_logs
  FOR SELECT
  TO authenticated
  USING (true);