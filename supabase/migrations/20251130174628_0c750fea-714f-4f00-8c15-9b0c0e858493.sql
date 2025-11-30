-- Fix get_or_create_conversation to filter by channel
-- This ensures WhatsApp and Web Chat conversations are completely separate

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_contact_id uuid, 
  p_department_id uuid DEFAULT NULL::uuid, 
  p_channel text DEFAULT 'web_chat'::text
)
RETURNS TABLE(conversation_id uuid, is_existing boolean, was_reopened boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conversation_id UUID;
  v_closed_conversation_id UUID;
BEGIN
  -- 1. Tenta achar uma ABERTA do mesmo CANAL
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE contact_id = p_contact_id 
    AND status = 'open'
    AND channel = p_channel::conversation_channel
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN QUERY SELECT v_conversation_id, TRUE, FALSE;
    RETURN;
  END IF;

  -- 2. Tenta achar uma FECHADA do mesmo CANAL para REABRIR
  SELECT id INTO v_closed_conversation_id
  FROM conversations
  WHERE contact_id = p_contact_id 
    AND status = 'closed'
    AND channel = p_channel::conversation_channel
  ORDER BY closed_at DESC NULLS LAST
  LIMIT 1;

  IF v_closed_conversation_id IS NOT NULL THEN
    UPDATE conversations
    SET status = 'open',
        closed_at = NULL,
        closed_by = NULL,
        auto_closed = FALSE,
        last_message_at = NOW(),
        department = COALESCE(p_department_id, department)
    WHERE id = v_closed_conversation_id;

    RETURN QUERY SELECT v_closed_conversation_id, TRUE, TRUE;
    RETURN;
  END IF;

  -- 3. Cria nova conversa
  INSERT INTO conversations (contact_id, department, channel, status, ai_mode)
  VALUES (p_contact_id, p_department_id, p_channel::conversation_channel, 'open', 'autopilot')
  RETURNING id INTO v_conversation_id;

  RETURN QUERY SELECT v_conversation_id, FALSE, FALSE;
END;
$function$;