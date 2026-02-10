
-- Step 1: Add denormalized columns for department and agent info
ALTER TABLE public.inbox_view ADD COLUMN IF NOT EXISTS department_name TEXT;
ALTER TABLE public.inbox_view ADD COLUMN IF NOT EXISTS department_color TEXT;
ALTER TABLE public.inbox_view ADD COLUMN IF NOT EXISTS assigned_agent_name TEXT;
ALTER TABLE public.inbox_view ADD COLUMN IF NOT EXISTS assigned_agent_avatar TEXT;

-- Step 2: Backfill existing data
UPDATE inbox_view iv SET
  department_name = d.name,
  department_color = d.color
FROM departments d
WHERE iv.department = d.id;

UPDATE inbox_view iv SET
  assigned_agent_name = p.full_name,
  assigned_agent_avatar = p.avatar_url
FROM profiles p
WHERE iv.assigned_to = p.id;

-- Step 3: Update INSERT trigger to include lookups
CREATE OR REPLACE FUNCTION public.create_inbox_view_on_conversation_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_contact RECORD;
  v_dept_name TEXT;
  v_dept_color TEXT;
  v_agent_name TEXT;
  v_agent_avatar TEXT;
BEGIN
  SELECT first_name, last_name, avatar_url, phone, email, whatsapp_id
  INTO v_contact
  FROM contacts
  WHERE id = NEW.contact_id;

  -- Lookup department info
  IF NEW.department IS NOT NULL THEN
    SELECT name, color INTO v_dept_name, v_dept_color
    FROM departments WHERE id = NEW.department;
  END IF;

  -- Lookup agent info
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT full_name, avatar_url INTO v_agent_name, v_agent_avatar
    FROM profiles WHERE id = NEW.assigned_to;
  END IF;
  
  INSERT INTO inbox_view (
    conversation_id, contact_id, contact_name, contact_avatar,
    contact_phone, contact_email, last_message_at, last_snippet,
    last_channel, last_sender_type, unread_count, channels,
    has_audio, has_attachments, status, ai_mode, assigned_to,
    department, sla_status, created_at, updated_at,
    whatsapp_instance_id, whatsapp_meta_instance_id, whatsapp_provider, contact_whatsapp_id,
    department_name, department_color, assigned_agent_name, assigned_agent_avatar
  ) VALUES (
    NEW.id, NEW.contact_id,
    TRIM(COALESCE(v_contact.first_name, '') || ' ' || COALESCE(v_contact.last_name, '')),
    v_contact.avatar_url, v_contact.phone, v_contact.email,
    NEW.last_message_at, NULL, NEW.channel::TEXT, NULL, 0,
    ARRAY[NEW.channel::TEXT], false, false, NEW.status::TEXT,
    NEW.ai_mode::TEXT, NEW.assigned_to, NEW.department, 'ok',
    NEW.created_at, now(),
    NEW.whatsapp_instance_id::TEXT, NEW.whatsapp_meta_instance_id::TEXT,
    NEW.whatsapp_provider, v_contact.whatsapp_id,
    v_dept_name, v_dept_color, v_agent_name, v_agent_avatar
  )
  ON CONFLICT (conversation_id) DO NOTHING;
  
  RETURN NEW;
END;
$function$;

-- Step 4: Update conversation UPDATE trigger to refresh dept/agent info
CREATE OR REPLACE FUNCTION public.update_inbox_view_on_conversation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dept_name TEXT;
  v_dept_color TEXT;
  v_agent_name TEXT;
  v_agent_avatar TEXT;
BEGIN
  -- Lookup department info
  IF NEW.department IS NOT NULL THEN
    SELECT name, color INTO v_dept_name, v_dept_color
    FROM departments WHERE id = NEW.department;
  END IF;

  -- Lookup agent info
  IF NEW.assigned_to IS NOT NULL THEN
    SELECT full_name, avatar_url INTO v_agent_name, v_agent_avatar
    FROM profiles WHERE id = NEW.assigned_to;
  END IF;

  UPDATE inbox_view SET
    status       = NEW.status::TEXT,
    ai_mode      = NEW.ai_mode::TEXT,
    assigned_to  = NEW.assigned_to,
    department   = NEW.department,
    whatsapp_instance_id = NEW.whatsapp_instance_id::TEXT,
    whatsapp_meta_instance_id = NEW.whatsapp_meta_instance_id::TEXT,
    whatsapp_provider = NEW.whatsapp_provider,
    department_name = v_dept_name,
    department_color = v_dept_color,
    assigned_agent_name = v_agent_name,
    assigned_agent_avatar = v_agent_avatar,
    updated_at   = now()
  WHERE conversation_id = NEW.id;
  RETURN NEW;
END;
$function$;
