-- Dropar função existente para recriar com nova lógica
DROP FUNCTION IF EXISTS public.get_or_create_conversation(UUID, UUID, TEXT);

-- Recriar função com fallback inteligente de departamento
CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  p_contact_id UUID,
  p_department_id UUID DEFAULT NULL,
  p_channel TEXT DEFAULT 'whatsapp'
)
RETURNS TABLE(conversation_id UUID, existed BOOLEAN, was_reopened BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id UUID;
  v_closed_conversation_id UUID;
  v_effective_department_id UUID;
BEGIN
  -- Definir departamento efetivo: usar o fornecido, ou buscar fallback
  IF p_department_id IS NOT NULL THEN
    v_effective_department_id := p_department_id;
  ELSE
    -- Fallback: primeiro tenta Suporte, depois Comercial
    SELECT id INTO v_effective_department_id
    FROM public.departments
    WHERE name = 'Suporte' AND is_active = true
    LIMIT 1;
    
    IF v_effective_department_id IS NULL THEN
      SELECT id INTO v_effective_department_id
      FROM public.departments
      WHERE name = 'Comercial' AND is_active = true
      LIMIT 1;
    END IF;
  END IF;

  -- 1. Buscar conversa ABERTA existente
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE contact_id = p_contact_id 
    AND status = 'open'
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN QUERY SELECT v_conversation_id, TRUE, FALSE;
    RETURN;
  END IF;

  -- 2. Buscar conversa FECHADA para reabrir
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
        department = COALESCE(p_department_id, department, v_effective_department_id)
    WHERE id = v_closed_conversation_id;

    RETURN QUERY SELECT v_closed_conversation_id, TRUE, TRUE;
    RETURN;
  END IF;

  -- 3. Criar nova conversa com departamento garantido
  INSERT INTO conversations (contact_id, department, channel, status, ai_mode)
  VALUES (p_contact_id, v_effective_department_id, p_channel::conversation_channel, 'open', 'autopilot')
  RETURNING id INTO v_conversation_id;

  RETURN QUERY SELECT v_conversation_id, FALSE, FALSE;
END;
$$;