-- FASE 1 & 2: Reverter isolamento + Adicionar canal nas mensagens

-- 1. Reverter get_or_create_conversation para buscar SEM filtro de canal
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
  -- 1. Buscar conversa ABERTA (SEM filtro de canal - Customer 360)
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE contact_id = p_contact_id 
    AND status = 'open'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN QUERY SELECT v_conversation_id, TRUE, FALSE;
    RETURN;
  END IF;

  -- 2. Buscar conversa FECHADA para REABRIR (SEM filtro de canal)
  SELECT id INTO v_closed_conversation_id
  FROM conversations
  WHERE contact_id = p_contact_id 
    AND status = 'closed'
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

  -- 3. Criar nova conversa (canal é registrado mas não usado para busca)
  INSERT INTO conversations (contact_id, department, channel, status, ai_mode)
  VALUES (p_contact_id, p_department_id, p_channel::conversation_channel, 'open', 'autopilot')
  RETURNING id INTO v_conversation_id;

  RETURN QUERY SELECT v_conversation_id, FALSE, FALSE;
END;
$function$;

-- 2. Adicionar coluna channel na tabela messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS channel conversation_channel DEFAULT 'web_chat';

-- Criar índice para otimizar busca por canal
CREATE INDEX IF NOT EXISTS idx_messages_conversation_channel ON messages(conversation_id, channel, created_at DESC);