-- Função para criar registro na inbox_view quando conversa é criada
CREATE OR REPLACE FUNCTION public.create_inbox_view_on_conversation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact RECORD;
BEGIN
  -- Buscar dados do contato
  SELECT first_name, last_name, avatar_url, phone, email
  INTO v_contact
  FROM contacts
  WHERE id = NEW.contact_id;
  
  -- Inserir na inbox_view
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
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.contact_id,
    TRIM(COALESCE(v_contact.first_name, '') || ' ' || COALESCE(v_contact.last_name, '')),
    v_contact.avatar_url,
    v_contact.phone,
    v_contact.email,
    NEW.last_message_at,
    NULL,
    NEW.channel::TEXT,
    NULL,
    0,
    ARRAY[NEW.channel::TEXT],
    false,
    false,
    NEW.status::TEXT,
    NEW.ai_mode::TEXT,
    NEW.assigned_to,
    NEW.department,
    'ok',
    NEW.created_at,
    now()
  )
  ON CONFLICT (conversation_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Trigger para INSERT em conversations
DROP TRIGGER IF EXISTS trigger_create_inbox_view_on_conversation_insert ON conversations;
CREATE TRIGGER trigger_create_inbox_view_on_conversation_insert
AFTER INSERT ON conversations
FOR EACH ROW
EXECUTE FUNCTION public.create_inbox_view_on_conversation_insert();