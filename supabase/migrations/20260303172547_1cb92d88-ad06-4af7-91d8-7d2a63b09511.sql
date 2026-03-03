
-- RPC to find conversations ready for buffer processing
CREATE OR REPLACE FUNCTION public.get_ready_buffer_conversations(p_cutoff timestamptz)
RETURNS TABLE(conversation_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT mb.conversation_id
  FROM public.message_buffer mb
  WHERE mb.processed = false
  GROUP BY mb.conversation_id
  HAVING max(mb.created_at) <= p_cutoff;
$$;
