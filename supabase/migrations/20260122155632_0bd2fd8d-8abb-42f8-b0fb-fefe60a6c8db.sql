-- ===================================================================
-- FIX: Corrigir sincronização de conversas reabertas no inbox_view
-- Problema: Conversas reabertas não aparecem na lista de ativas
-- ===================================================================

-- 1. Corrigir trigger update_inbox_view_on_message para sincronizar status
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
  -- Buscar dados ATUALIZADOS da conversa (status pode ter mudado para 'open')
  SELECT * INTO v_conversation FROM conversations WHERE id = NEW.conversation_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  
  -- Buscar dados do contato
  SELECT * INTO v_contact FROM contacts WHERE id = v_conversation.contact_id;
  
  -- Calcular canais únicos
  SELECT ARRAY_AGG(DISTINCT channel::TEXT) INTO v_channels
  FROM messages WHERE conversation_id = NEW.conversation_id;
  
  -- Verificar se tem áudio ou anexos
  SELECT 
    COALESCE(bool_or(ma.mime_type LIKE 'audio/%'), false),
    COALESCE(bool_or(ma.id IS NOT NULL), false)
  INTO v_has_audio, v_has_attachments
  FROM messages m
  LEFT JOIN media_attachments ma ON ma.message_id = m.id
  WHERE m.conversation_id = NEW.conversation_id;
  
  -- Upsert na inbox_view - AGORA SINCRONIZANDO STATUS
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
    -- ✅ FIX: Sincronizar estes campos que estavam faltando
    status = EXCLUDED.status,
    ai_mode = EXCLUDED.ai_mode,
    assigned_to = EXCLUDED.assigned_to,
    department = EXCLUDED.department,
    -- Fim do fix
    sla_status = EXCLUDED.sla_status,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- 2. Atualizar também o segundo trigger (se existir)
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
  -- ✅ FIX: Buscar status atual da conversa
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
    last_sender_type = NEW.sender_type,
    has_audio        = has_audio OR (NEW.message_type = 'audio'),
    has_attachments  = has_attachments OR (NEW.message_type IN ('image', 'video', 'document', 'file')),
    unread_count     = unread_count + CASE WHEN v_is_customer THEN 1 ELSE 0 END,
    channels         = CASE
                         WHEN v_last_channel IS NOT NULL AND NOT (v_last_channel = ANY(COALESCE(channels, '{}'))) 
                         THEN array_append(COALESCE(channels, '{}'), v_last_channel)
                         ELSE channels
                       END,
    -- ✅ FIX: Sincronizar status quando conversa foi reaberta
    status           = COALESCE(v_conversation.status::TEXT, status),
    ai_mode          = COALESCE(v_conversation.ai_mode::TEXT, ai_mode),
    assigned_to      = COALESCE(v_conversation.assigned_to, assigned_to),
    department       = COALESCE(v_conversation.department, department),
    updated_at       = now()
  WHERE conversation_id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

-- 3. Criar função normalize_phone para evitar duplicatas futuras
CREATE OR REPLACE FUNCTION normalize_phone(phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  -- Remove tudo exceto dígitos e retorna últimos 11
  RETURN RIGHT(REGEXP_REPLACE(COALESCE(phone, ''), '[^0-9]', '', 'g'), 11);
END;
$$;

-- 4. Sincronizar inbox_view para conversas que podem estar dessincronizadas
UPDATE inbox_view iv
SET 
  status = c.status::TEXT,
  ai_mode = c.ai_mode::TEXT,
  assigned_to = c.assigned_to,
  department = c.department
FROM conversations c
WHERE iv.conversation_id = c.id
  AND iv.status != c.status::TEXT;

-- 5. Fechar conversas duplicadas por contato (manter apenas a mais recente aberta)
WITH ranked_conversations AS (
  SELECT 
    c.id,
    c.contact_id,
    ROW_NUMBER() OVER (
      PARTITION BY c.contact_id 
      ORDER BY c.last_message_at DESC NULLS LAST
    ) as rn
  FROM conversations c
  WHERE c.status = 'open'
)
UPDATE conversations
SET 
  status = 'closed', 
  closed_at = NOW(), 
  auto_closed = true
WHERE id IN (
  SELECT id FROM ranked_conversations WHERE rn > 1
);

-- 6. Sincronizar inbox_view após fechar duplicatas
UPDATE inbox_view iv
SET status = 'closed'
FROM conversations c
WHERE iv.conversation_id = c.id
  AND c.status = 'closed'
  AND iv.status = 'open';