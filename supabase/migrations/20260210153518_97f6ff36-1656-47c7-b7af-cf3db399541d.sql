
-- Step 1: Add 4 new columns to inbox_view table
ALTER TABLE public.inbox_view 
  ADD COLUMN IF NOT EXISTS whatsapp_instance_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_meta_instance_id TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_provider TEXT,
  ADD COLUMN IF NOT EXISTS contact_whatsapp_id TEXT;

-- Step 2: Backfill existing data from conversations + contacts
UPDATE public.inbox_view iv SET
  whatsapp_instance_id = c.whatsapp_instance_id::TEXT,
  whatsapp_meta_instance_id = c.whatsapp_meta_instance_id::TEXT,
  whatsapp_provider = c.whatsapp_provider,
  contact_whatsapp_id = ct.whatsapp_id
FROM conversations c
JOIN contacts ct ON ct.id = c.contact_id
WHERE iv.conversation_id = c.id;

-- Step 3: Update INSERT trigger to include WhatsApp fields
CREATE OR REPLACE FUNCTION public.create_inbox_view_on_conversation_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_contact RECORD;
BEGIN
  SELECT first_name, last_name, avatar_url, phone, email, whatsapp_id
  INTO v_contact
  FROM contacts
  WHERE id = NEW.contact_id;
  
  INSERT INTO inbox_view (
    conversation_id, contact_id, contact_name, contact_avatar,
    contact_phone, contact_email, last_message_at, last_snippet,
    last_channel, last_sender_type, unread_count, channels,
    has_audio, has_attachments, status, ai_mode, assigned_to,
    department, sla_status, created_at, updated_at,
    whatsapp_instance_id, whatsapp_meta_instance_id, whatsapp_provider, contact_whatsapp_id
  ) VALUES (
    NEW.id, NEW.contact_id,
    TRIM(COALESCE(v_contact.first_name, '') || ' ' || COALESCE(v_contact.last_name, '')),
    v_contact.avatar_url, v_contact.phone, v_contact.email,
    NEW.last_message_at, NULL, NEW.channel::TEXT, NULL, 0,
    ARRAY[NEW.channel::TEXT], false, false, NEW.status::TEXT,
    NEW.ai_mode::TEXT, NEW.assigned_to, NEW.department, 'ok',
    NEW.created_at, now(),
    NEW.whatsapp_instance_id::TEXT, NEW.whatsapp_meta_instance_id::TEXT,
    NEW.whatsapp_provider, v_contact.whatsapp_id
  )
  ON CONFLICT (conversation_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 4: Update the UPDATE trigger to sync WhatsApp fields
CREATE OR REPLACE FUNCTION public.update_inbox_view_on_conversation_update()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE inbox_view SET
    status       = NEW.status::TEXT,
    ai_mode      = NEW.ai_mode::TEXT,
    assigned_to  = NEW.assigned_to,
    department   = NEW.department,
    whatsapp_instance_id = NEW.whatsapp_instance_id::TEXT,
    whatsapp_meta_instance_id = NEW.whatsapp_meta_instance_id::TEXT,
    whatsapp_provider = NEW.whatsapp_provider,
    updated_at   = now()
  WHERE conversation_id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
