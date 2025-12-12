-- 1. Adicionar índice em updated_at para cursor-based fetch
CREATE INDEX IF NOT EXISTS idx_inbox_view_updated_at ON inbox_view(updated_at DESC);

-- 2. Índices adicionais para performance
CREATE INDEX IF NOT EXISTS idx_inbox_view_assigned_to ON inbox_view(assigned_to);
CREATE INDEX IF NOT EXISTS idx_inbox_view_status ON inbox_view(status);
CREATE INDEX IF NOT EXISTS idx_inbox_view_last_message_at ON inbox_view(last_message_at DESC);

-- 3. Alterar REPLICA IDENTITY para FULL (melhora diff de updates no realtime)
ALTER TABLE inbox_view REPLICA IDENTITY FULL;

-- 4. Criar trigger para auto-update de updated_at
CREATE OR REPLACE FUNCTION public.touch_inbox_view_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_touch_updated_at_inbox_view ON inbox_view;
CREATE TRIGGER tr_touch_updated_at_inbox_view
BEFORE UPDATE ON inbox_view
FOR EACH ROW
EXECUTE FUNCTION public.touch_inbox_view_updated_at();

-- 5. Trigger para atualizar inbox_view quando conversations é atualizada
CREATE OR REPLACE FUNCTION public.update_inbox_view_on_conversation_update()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE inbox_view SET
    status       = NEW.status::TEXT,
    ai_mode      = NEW.ai_mode::TEXT,
    assigned_to  = NEW.assigned_to,
    department   = NEW.department,
    updated_at   = now()
  WHERE conversation_id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_inbox_view_on_conversation ON conversations;
CREATE TRIGGER trigger_update_inbox_view_on_conversation
AFTER UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION public.update_inbox_view_on_conversation_update();

-- 6. Trigger para atualizar inbox_view quando mensagem é inserida
CREATE OR REPLACE FUNCTION public.update_inbox_view_on_message_insert()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_customer boolean;
  v_last_snippet text;
  v_last_channel text;
BEGIN
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
    updated_at       = now()
  WHERE conversation_id = NEW.conversation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_inbox_view_on_message_insert ON messages;
CREATE TRIGGER trigger_update_inbox_view_on_message_insert
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION public.update_inbox_view_on_message_insert();