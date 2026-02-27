-- Add short_id TEXT column to inbox_view for protocol search
ALTER TABLE public.inbox_view ADD COLUMN IF NOT EXISTS short_id TEXT;

-- Backfill existing rows
UPDATE public.inbox_view SET short_id = LEFT(conversation_id::text, 8) WHERE short_id IS NULL;

-- Create index for fast search
CREATE INDEX IF NOT EXISTS idx_inbox_view_short_id ON public.inbox_view (short_id);

-- Trigger function to auto-populate short_id on INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.fn_inbox_view_set_short_id()
RETURNS TRIGGER AS $$
BEGIN
  NEW.short_id := LEFT(NEW.conversation_id::text, 8);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS trg_inbox_view_set_short_id ON public.inbox_view;
CREATE TRIGGER trg_inbox_view_set_short_id
  BEFORE INSERT OR UPDATE OF conversation_id ON public.inbox_view
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_inbox_view_set_short_id();