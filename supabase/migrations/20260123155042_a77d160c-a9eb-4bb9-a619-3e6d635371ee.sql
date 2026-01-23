-- Atualizar função get_or_create_conversation para limpar atribuição ao reabrir conversas
-- Isso garante que cada reabertura seja tratada como novo atendimento com triagem IA

-- Dropar função existente primeiro (necessário porque estamos alterando detalhes internos)
DROP FUNCTION IF EXISTS get_or_create_conversation(UUID, UUID, TEXT);

-- Recriar função com correção
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
  v_effective_department_id UUID;
BEGIN
  -- Determinar departamento efetivo (do contato ou parâmetro)
  IF p_department_id IS NULL THEN
    SELECT support_channel_id INTO v_effective_department_id
    FROM contacts
    WHERE id = p_contact_id;
  ELSE
    v_effective_department_id := p_department_id;
  END IF;

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
        department = COALESCE(p_department_id, department, v_effective_department_id),
        -- CORREÇÃO: Limpar atribuição anterior e resetar IA
        assigned_to = NULL,        -- Conversa vai para pool/redistribuição
        ai_mode = 'autopilot',     -- IA atende primeiro na reabertura
        previous_agent_id = assigned_to  -- Salvar agente anterior para referência
    WHERE id = v_closed_conversation_id;

    RETURN QUERY SELECT v_closed_conversation_id, TRUE, TRUE;
    RETURN;
  END IF;

  -- 3. Cria nova conversa
  INSERT INTO conversations (contact_id, department, channel, status, ai_mode)
  VALUES (p_contact_id, COALESCE(p_department_id, v_effective_department_id), p_channel::conversation_channel, 'open', 'autopilot')
  RETURNING id INTO v_conversation_id;

  RETURN QUERY SELECT v_conversation_id, FALSE, FALSE;
END;
$$;