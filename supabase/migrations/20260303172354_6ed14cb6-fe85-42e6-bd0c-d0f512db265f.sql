
-- Step 2: Add metadata columns to message_buffer
ALTER TABLE public.message_buffer
  ADD COLUMN IF NOT EXISTS contact_id uuid,
  ADD COLUMN IF NOT EXISTS instance_id uuid,
  ADD COLUMN IF NOT EXISTS from_number text,
  ADD COLUMN IF NOT EXISTS flow_context jsonb,
  ADD COLUMN IF NOT EXISTS flow_data jsonb;

-- Step 5: Advisory lock RPC for buffer processing
CREATE OR REPLACE FUNCTION public.try_lock_conversation_buffer(conv_id uuid)
RETURNS boolean
LANGUAGE plpgsql AS $$
BEGIN
  RETURN pg_try_advisory_xact_lock(hashtext(conv_id::text));
END;
$$;
