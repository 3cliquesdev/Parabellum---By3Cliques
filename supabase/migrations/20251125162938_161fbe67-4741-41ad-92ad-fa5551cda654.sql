-- FASE 1: Limpeza de Duplicatas
-- Deletar conversas duplicadas, mantendo apenas a mais recente por contact_id + status
DELETE FROM conversations
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY contact_id, status ORDER BY created_at DESC) as rnum
    FROM conversations
  ) t
  WHERE t.rnum > 1
);

-- FASE 2: Unique Index Parcial (Trava de Segurança)
-- Impede matematicamente 2 conversas abertas para o mesmo cliente
CREATE UNIQUE INDEX idx_one_open_conversation_per_contact
ON conversations (contact_id)
WHERE status = 'open';

-- FASE 3: Função RPC Inteligente (Get or Create + Reopen)
CREATE OR REPLACE FUNCTION get_or_create_conversation(
  p_contact_id UUID,
  p_department_id UUID DEFAULT NULL,
  p_channel TEXT DEFAULT 'web_chat'
)
RETURNS TABLE(
  conversation_id UUID,
  is_existing BOOLEAN,
  was_reopened BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_conversation_id UUID;
  v_closed_conversation_id UUID;
BEGIN
  -- 1. Tenta achar uma ABERTA
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE contact_id = p_contact_id AND status = 'open'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN QUERY SELECT v_conversation_id, TRUE, FALSE;
    RETURN;
  END IF;

  -- 2. Tenta achar uma FECHADA para REABRIR
  SELECT id INTO v_closed_conversation_id
  FROM conversations
  WHERE contact_id = p_contact_id AND status = 'closed'
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
$$;