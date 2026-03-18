CREATE OR REPLACE FUNCTION public.take_control_secure(p_conversation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_conversation RECORD;
  v_profile RECORD;
  v_is_authorized BOOLEAN := false;
BEGIN
  -- 1. Buscar conversa
  SELECT c.*, d.name as dept_name
  INTO v_conversation
  FROM conversations c
  LEFT JOIN departments d ON d.id = c.department
  WHERE c.id = p_conversation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conversa não encontrada');
  END IF;

  -- 2. Buscar perfil do usuário
  SELECT id, full_name, availability_status
  INTO v_profile
  FROM profiles
  WHERE id = v_caller_id;

  -- 3. Verificar se é manager/admin (não precisa estar online)
  IF has_role(v_caller_id, 'admin'::app_role)
     OR has_role(v_caller_id, 'manager'::app_role)
     OR has_role(v_caller_id, 'general_manager'::app_role)
     OR has_role(v_caller_id, 'cs_manager'::app_role)
     OR has_role(v_caller_id, 'support_manager'::app_role)
     OR has_role(v_caller_id, 'financial_manager'::app_role)
  THEN
    v_is_authorized := true;
  ELSE
    -- Agentes precisam estar online
    IF v_profile.availability_status != 'online' THEN
      RETURN jsonb_build_object('success', false, 'error', 'Altere seu status para Online');
    END IF;

    -- Conversa não atribuída pode ser assumida por qualquer agente
    IF v_conversation.assigned_to IS NULL THEN
      v_is_authorized := true;
    -- Conversa atribuída ao próprio usuário
    ELSIF v_conversation.assigned_to = v_caller_id THEN
      v_is_authorized := true;
    END IF;
  END IF;

  IF NOT v_is_authorized THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão');
  END IF;

  -- 4. Executar takeover
  UPDATE conversations
  SET
    ai_mode = 'copilot',
    assigned_to = v_caller_id
  WHERE id = p_conversation_id;

  -- 5. Limpar flow states ativos (DELETE em vez de UPDATE para evitar colisão com unique_active_flow)
  DELETE FROM chat_flow_states
  WHERE conversation_id = p_conversation_id
    AND status IN ('waiting_input', 'active', 'in_progress');

  -- 6. Inserir mensagem de sistema
  INSERT INTO messages (conversation_id, content, sender_type, sender_id, is_ai_generated)
  VALUES (
    p_conversation_id,
    format('O atendente **%s** entrou na conversa.', COALESCE(v_profile.full_name, 'Suporte')),
    'system',
    v_caller_id,
    false
  );

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'assigned_to', v_caller_id,
    'ai_mode', 'copilot'
  );
END;
$$;