
-- Enum for error types
CREATE TYPE public.client_error_type AS ENUM ('runtime', 'network', 'edge_function', 'chunk', 'unhandled_rejection');

-- Table to persist frontend errors
CREATE TABLE public.client_error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  error_type client_error_type NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for querying recent errors
CREATE INDEX idx_client_error_logs_created_at ON public.client_error_logs (created_at DESC);
CREATE INDEX idx_client_error_logs_type ON public.client_error_logs (error_type);

-- Table for daily error digests
CREATE TABLE public.error_digests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_date DATE NOT NULL,
  total_errors INTEGER NOT NULL DEFAULT 0,
  errors_by_type JSONB DEFAULT '{}',
  top_errors JSONB DEFAULT '[]',
  edge_function_failures JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(digest_date)
);

-- RLS
ALTER TABLE public.client_error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_digests ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can INSERT errors (their own)
CREATE POLICY "Users can insert their own errors"
  ON public.client_error_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admins can read all errors
CREATE POLICY "Admins can read error logs"
  ON public.client_error_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can read digests
CREATE POLICY "Admins can read error digests"
  ON public.error_digests FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role (edge functions) can insert digests
CREATE POLICY "Service can insert digests"
  ON public.error_digests FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow anon/service to insert error logs (for unauthenticated errors)
CREATE POLICY "Anon can insert error logs"
  ON public.client_error_logs FOR INSERT
  TO anon
  WITH CHECK (user_id IS NULL);

-- Auto-cleanup: delete logs older than 30 days (function + cron-ready)
CREATE OR REPLACE FUNCTION public.cleanup_old_error_logs()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.client_error_logs WHERE created_at < now() - interval '30 days';
$$;
