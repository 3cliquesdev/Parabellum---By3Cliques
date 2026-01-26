-- Função segura para transferência de conversas (bypassa RLS com validação)
CREATE OR REPLACE FUNCTION public.transfer_conversation_secure(
  p_conversation_id UUID,
  p_to_user_id UUID,
  p_to_department_id UUID,
  p_transfer_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_has_permission BOOLEAN;
  v_conversation RECORD;
  v_from_user_name TEXT;
  v_to_user_name TEXT;
  v_department_name TEXT;
BEGIN
  -- 1. Verificar se o usuário tem permissão inbox.transfer
  SELECT EXISTS(
    SELECT 1 FROM role_permissions rp
    JOIN user_roles ur ON ur.role::text = rp.role::text
    WHERE ur.user_id = v_caller_id
      AND rp.permission_key = 'inbox.transfer'
      AND rp.enabled = true
  ) OR public.has_role(v_caller_id, 'admin')
  INTO v_has_permission;

  IF NOT v_has_permission THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sem permissão para transferir conversas');
  END IF;

  -- 2. Verificar se a conversa existe e buscar dados atuais
  SELECT c.*, ct.first_name, ct.last_name
  INTO v_conversation
  FROM conversations c
  JOIN contacts ct ON ct.id = c.contact_id
  WHERE c.id = p_conversation_id;

  IF v_conversation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Conversa não encontrada');
  END IF;

  -- 3. Buscar nomes para auditoria
  SELECT full_name INTO v_from_user_name 
  FROM profiles WHERE id = v_conversation.assigned_to;
  
  SELECT full_name INTO v_to_user_name 
  FROM profiles WHERE id = p_to_user_id;
  
  SELECT name INTO v_department_name 
  FROM departments WHERE id = p_to_department_id;

  -- 4. Executar transferência (bypassa RLS por ser SECURITY DEFINER)
  UPDATE conversations
  SET 
    assigned_to = p_to_user_id,
    department = p_to_department_id,
    previous_agent_id = v_conversation.assigned_to
  WHERE id = p_conversation_id;

  -- 5. Registrar interação de auditoria
  INSERT INTO interactions (
    customer_id,
    type,
    content,
    channel,
    metadata
  ) VALUES (
    v_conversation.contact_id,
    'conversation_transferred',
    format('🔄 Conversa transferida de %s para %s (%s)',
      COALESCE(v_from_user_name, 'Pool'),
      COALESCE(v_to_user_name, 'Pool do Departamento'),
      COALESCE(v_department_name, 'Departamento')
    ),
    'other',
    jsonb_build_object(
      'from_user_id', v_conversation.assigned_to,
      'to_user_id', p_to_user_id,
      'from_user_name', v_from_user_name,
      'to_user_name', v_to_user_name,
      'to_department_id', p_to_department_id,
      'to_department_name', v_department_name,
      'conversation_id', p_conversation_id,
      'transfer_note', p_transfer_note,
      'transferred_by', v_caller_id,
      'is_internal', true
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'conversation_id', p_conversation_id,
    'to_user_id', p_to_user_id,
    'to_department_id', p_to_department_id
  );
END;
$$;