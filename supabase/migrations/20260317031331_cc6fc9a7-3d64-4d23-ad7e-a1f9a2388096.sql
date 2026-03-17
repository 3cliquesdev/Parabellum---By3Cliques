CREATE TABLE IF NOT EXISTS public.email_send_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text,
  template_name text,
  recipient_email text,
  status text DEFAULT 'pending',
  error_message text,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_send_log' AND policyname = 'Service role can manage email_send_log'
  ) THEN
    CREATE POLICY "Service role can manage email_send_log"
      ON public.email_send_log
      FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'email_send_log' AND policyname = 'Authenticated users can read email_send_log'
  ) THEN
    CREATE POLICY "Authenticated users can read email_send_log"
      ON public.email_send_log
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;