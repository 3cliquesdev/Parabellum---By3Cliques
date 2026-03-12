
-- ===================================================================
-- ADD contact_status + contact_kiwify_validated to inbox_view
-- + trigger to sync from contacts + backfill + update upsert functions
-- ===================================================================

-- 1. Add columns
ALTER TABLE public.inbox_view 
  ADD COLUMN IF NOT EXISTS contact_status TEXT,
  ADD COLUMN IF NOT EXISTS contact_kiwify_validated BOOLEAN DEFAULT false;

-- 2. Backfill from contacts
UPDATE public.inbox_view iv
SET 
  contact_status = c.status::TEXT,
  contact_kiwify_validated = COALESCE(c.kiwify_validated, false)
FROM public.contacts c
WHERE iv.contact_id = c.id;

-- 3. Trigger: sync contact status changes to inbox_view
CREATE OR REPLACE FUNCTION public.sync_inbox_view_contact_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status 
     OR OLD.kiwify_validated IS DISTINCT FROM NEW.kiwify_validated THEN
    UPDATE inbox_view
    SET 
      contact_status = NEW.status::TEXT,
      contact_kiwify_validated = COALESCE(NEW.kiwify_validated, false),
      updated_at = now()
    WHERE contact_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sync_inbox_view_contact_status ON public.contacts;
CREATE TRIGGER trigger_sync_inbox_view_contact_status
AFTER UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.sync_inbox_view_contact_status();

-- 4. Update the main upsert function to include new columns
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
    assigned_to, department, sla_status, updated_at,
    contact_status, contact_kiwify_validated
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
    now(),
    v_contact.status::TEXT,
    COALESCE(v_contact.kiwify_validated, false)
  )
  ON CONFLICT (conversation_id) DO UPDATE SET
    last_message_at = EXCLUDED.last_message_at,
    last_snippet = EXCLUDED.last_snippet,
    last_channel = EXCLUDED.last_channel,
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
    contact_status = EXCLUDED.contact_status,
    contact_kiwify_validated = EXCLUDED.contact_kiwify_validated,
    updated_at = now();
  
  RETURN NEW;
END;
$$;
