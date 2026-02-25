
-- ===================================================================
-- FIX: Trigger guard — mensagens 'system' não sobrescrevem last_sender_type
-- + Backfill de dados legados onde last_sender_type ficou 'system'
-- ===================================================================

-- Fase A: Recriar update_inbox_view_on_message() com guarda
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
  SELECT * INTO v_conversation FROM conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  
  SELECT * INTO v_contact FROM contacts WHERE id = v_conversation.contact_id;
  
  SELECT ARRAY_AGG(DISTINCT channel::TEXT) INTO v_channels
  FROM messages WHERE conversation_id = NEW.conversation_id;
  
  SELECT 
    COALESCE(bool_or(ma.mime_type LIKE 'audio/%'), false),
    COALESCE(bool_or(ma.id IS NOT NULL), false)
  INTO v_has_audio, v_has_attachments
  FROM messages m
  LEFT JOIN media_attachments ma ON ma.message_id = m.id
  WHERE m.conversation_id = NEW.conversation_id;
  
  INSERT INTO inbox_view (
    conversation_id, contact_id, contact_name, contact_avatar,
    contact_phone, contact_email, last_message_at, last_snippet,
    last_channel, last_sender_type, unread_count, channels,
    has_audio, has_attachments, status, ai_mode,
    assigned_to, department, sla_status, updated_at
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
    -- GUARD: só grava sender_type real no INSERT inicial
    CASE WHEN NEW.sender_type IN ('contact', 'user') THEN NEW.sender_type::TEXT ELSE 'contact' END,
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
    -- ✅ GUARD: só atualiza last_sender_type para mensagens reais (contact/user)
    last_sender_type = CASE
      WHEN EXCLUDED.last_sender_type IN ('contact', 'user') THEN EXCLUDED.last_sender_type
      ELSE inbox_view.last_sender_type
    END,
    unread_count = CASE 
      WHEN EXCLUDED.last_sender_type = 'contact' 
      THEN inbox_view.unread_count + 1 
      ELSE 0 
    END,
    channels = EXCLUDED.channels,
    has_audio = EXCLUDED.has_audio,
    has_attachments = EXCLUDED.has_attachments,
    status = EXCLUDED.status,
    ai_mode = EXCLUDED.ai_mode,
    assigned_to = EXCLUDED.assigned_to,
    department = EXCLUDED.department,
    sla_status = EXCLUDED.sla_status,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Fase A (parte 2): Recriar update_inbox_view_on_message_insert() com guarda
CREATE OR REPLACE FUNCTION public.update_inbox_view_on_message_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation RECORD;
  v_is_customer boolean;
  v_last_snippet text;
  v_last_channel text;
BEGIN
  SELECT status, ai_mode, assigned_to, department 
  INTO v_conversation 
  FROM conversations 
  WHERE id = NEW.conversation_id;
  
  v_is_customer := (NEW.sender_type = 'contact');
  v_last_snippet := substring(NEW.content for 160);
  v_last_channel := COALESCE(NEW.channel::TEXT, 'whatsapp');

  UPDATE inbox_view SET
    last_message_at  = NEW.created_at,
    last_snippet     = v_last_snippet,
    last_channel     = v_last_channel,
    -- ✅ GUARD: só atualiza last_sender_type para mensagens reais (contact/user)
    last_sender_type = CASE
      WHEN NEW.sender_type IN ('contact', 'user') THEN NEW.sender_type::TEXT
      ELSE last_sender_type
    END,
    has_audio        = has_audio OR (NEW.message_type = 'audio'),
    has_attachments  = has_attachments OR (NEW.message_type IN ('image', 'video', 'document', 'file')),
    unread_count     = unread_count + CASE WHEN v_is_customer THEN 1 ELSE 0 END,
    channels         = CASE
                         WHEN v_last_channel IS NOT NULL AND NOT (v_last_channel = ANY(COALESCE(channels, '{}'))) 
                         THEN array_append(COALESCE(channels, '{}'), v_last_channel)
                         ELSE channels
                       END,
    status           = COALESCE(v_conversation.status::TEXT, status),
    ai_mode          = COALESCE(v_conversation.ai_mode::TEXT, ai_mode),
    assigned_to      = COALESCE(v_conversation.assigned_to, assigned_to),
    department       = COALESCE(v_conversation.department, department),
    updated_at       = now()
  WHERE conversation_id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

-- Fase B: Backfill — corrigir conversas legadas com last_sender_type = 'system'
UPDATE inbox_view iv
SET last_sender_type = sub.real_sender_type
FROM (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.sender_type::TEXT AS real_sender_type
  FROM messages m
  WHERE m.sender_type IN ('contact', 'user')
  ORDER BY m.conversation_id, m.created_at DESC
) sub
WHERE sub.conversation_id = iv.conversation_id
  AND iv.last_sender_type NOT IN ('contact', 'user');
