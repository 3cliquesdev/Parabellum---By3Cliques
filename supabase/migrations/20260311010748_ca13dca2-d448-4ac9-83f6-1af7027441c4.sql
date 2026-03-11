ALTER TABLE public.chat_flow_states ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE public.chat_flow_states SET updated_at = COALESCE(completed_at, started_at, now()) WHERE updated_at IS NULL;