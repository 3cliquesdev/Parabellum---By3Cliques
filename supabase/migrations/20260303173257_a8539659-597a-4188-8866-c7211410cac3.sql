-- Add processed_at column for audit
ALTER TABLE public.message_buffer ADD COLUMN IF NOT EXISTS processed_at timestamptz;

-- Auto-set processed_at when processed becomes true
CREATE OR REPLACE FUNCTION public.set_processed_at()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.processed = true AND (OLD.processed IS DISTINCT FROM true) THEN
    NEW.processed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_processed_at ON public.message_buffer;
CREATE TRIGGER trg_set_processed_at
  BEFORE UPDATE ON public.message_buffer
  FOR EACH ROW
  EXECUTE FUNCTION public.set_processed_at();