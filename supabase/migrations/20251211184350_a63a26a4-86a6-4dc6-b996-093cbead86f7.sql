-- Sprint 1 Part 2: Funções e Triggers para inbox_view

-- Função para calcular SLA status
CREATE OR REPLACE FUNCTION calculate_sla_status(
  p_last_message_at TIMESTAMPTZ,
  p_last_sender_type TEXT,
  p_status TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hours_since NUMERIC;
BEGIN
  IF p_status != 'open' OR p_last_sender_type != 'contact' THEN
    RETURN 'ok';
  END IF;
  
  hours_since := EXTRACT(EPOCH FROM (now() - p_last_message_at)) / 3600;
  
  IF hours_since >= 4 THEN
    RETURN 'critical';
  ELSIF hours_since >= 1 THEN
    RETURN 'warning';
  ELSE
    RETURN 'ok';
  END IF;
END;
$$;

-- Função para atualizar inbox_view quando mensagem é inserida
CREATE OR REPLACE FUNCTION update_inbox_view_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation RECORD;
  v_contact RECORD;
  v_channels TEXT[];
  v_has_audio BOOLEAN := false;
  v_has_attachments BOOLEAN := false;
BEGIN
  -- Buscar dados da conversa
  SELECT * INTO v_conversation FROM conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  
  -- Buscar dados do contato
  SELECT * INTO v_contact FROM contacts WHERE id = v_conversation.contact_id;
  
  -- Calcular canais únicos
  SELECT ARRAY_AGG(DISTINCT channel::TEXT) INTO v_channels
  FROM messages WHERE conversation_id = NEW.conversation_id;
  
  -- Verificar se tem áudio ou anexos (simplificado)
  SELECT 
    COALESCE(bool_or(ma.mime_type LIKE 'audio/%'), false),
    COALESCE(bool_or(ma.id IS NOT NULL), false)
  INTO v_has_audio, v_has_attachments
  FROM messages m
  LEFT JOIN media_attachments ma ON ma.message_id = m.id
  WHERE m.conversation_id = NEW.conversation_id;
  
  -- Upsert na inbox_view
  INSERT INTO inbox_view (
    conversation_id,
    contact_id,
    contact_name,
    contact_avatar,
    contact_phone,
    contact_email,
    last_message_at,
    last_snippet,
    last_channel,
    last_sender_type,
    unread_count,
    channels,
    has_audio,
    has_attachments,
    status,
    ai_mode,
    assigned_to,
    department,
    sla_status,
    updated_at
  ) VALUES (
    NEW.conversation_id,
    v_conversation.contact_id,
    COALESCE(v_contact.first_name || ' ' || v_contact.last_name, 'Desconhecido'),
    v_contact.avatar_url,
    v_contact.phone,
    v_contact.email,
    NEW.created_at,
    LEFT(NEW.content, 100),
    NEW.channel::TEXT,
    NEW.sender_type::TEXT,
    CASE WHEN NEW.sender_type::TEXT = 'contact' THEN 1 ELSE 0 END,
    COALESCE(v_channels, ARRAY[NEW.channel::TEXT]),
    COALESCE(v_has_audio, false),
    COALESCE(v_has_attachments, false),
    v_conversation.status::TEXT,
    v_conversation.ai_mode::TEXT,
    v_conversation.assigned_to,
    v_conversation.department,
    calculate_sla_status(NEW.created_at, NEW.sender_type::TEXT, v_conversation.status::TEXT),
    now()
  )
  ON CONFLICT (conversation_id) DO UPDATE SET
    last_message_at = EXCLUDED.last_message_at,
    last_snippet = EXCLUDED.last_snippet,
    last_channel = EXCLUDED.last_channel,
    last_sender_type = EXCLUDED.last_sender_type,
    unread_count = CASE 
      WHEN EXCLUDED.last_sender_type = 'contact' 
      THEN inbox_view.unread_count + 1 
      ELSE 0 
    END,
    channels = EXCLUDED.channels,
    has_audio = EXCLUDED.has_audio,
    has_attachments = EXCLUDED.has_attachments,
    sla_status = EXCLUDED.sla_status,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Trigger para atualizar inbox_view em novas mensagens
CREATE TRIGGER trigger_update_inbox_view_on_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION update_inbox_view_on_message();

-- Função para atualizar inbox_view quando conversa muda
CREATE OR REPLACE FUNCTION update_inbox_view_on_conversation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inbox_view SET
    status = NEW.status::TEXT,
    ai_mode = NEW.ai_mode::TEXT,
    assigned_to = NEW.assigned_to,
    department = NEW.department,
    sla_status = calculate_sla_status(
      inbox_view.last_message_at, 
      inbox_view.last_sender_type, 
      NEW.status::TEXT
    ),
    updated_at = now()
  WHERE conversation_id = NEW.id;
  
  RETURN NEW;
END;
$$;

-- Trigger para atualizar inbox_view quando conversa muda
CREATE TRIGGER trigger_update_inbox_view_on_conversation
AFTER UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION update_inbox_view_on_conversation();

-- Função para resetar unread_count (chamada ao abrir conversa)
CREATE OR REPLACE FUNCTION reset_inbox_unread_count(p_conversation_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inbox_view 
  SET unread_count = 0, updated_at = now()
  WHERE conversation_id = p_conversation_id;
END;
$$;