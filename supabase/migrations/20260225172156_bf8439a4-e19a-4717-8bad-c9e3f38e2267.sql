
-- Função que sincroniza consultant_id do contato para conversas abertas sem assigned_to
CREATE OR REPLACE FUNCTION public.sync_consultant_to_open_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_conv RECORD;
BEGIN
  -- Atualiza conversas abertas sem agente atribuído
  FOR updated_conv IN
    UPDATE conversations
    SET assigned_to = NEW.consultant_id,
        ai_mode = 'copilot',
        updated_at = now()
    WHERE contact_id = NEW.id
      AND status = 'open'
      AND assigned_to IS NULL
    RETURNING id
  LOOP
    -- Log de auditoria em interactions
    INSERT INTO interactions (
      conversation_id,
      type,
      content,
      metadata,
      created_at
    ) VALUES (
      updated_conv.id,
      'note',
      'Conversa atribuída automaticamente ao consultor do contato (sync_consultant_trigger)',
      jsonb_build_object(
        'trigger', 'sync_consultant_to_open_conversations',
        'consultant_id', NEW.consultant_id,
        'contact_id', NEW.id
      ),
      now()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger na tabela contacts
DROP TRIGGER IF EXISTS sync_consultant_to_open_conversations ON contacts;
CREATE TRIGGER sync_consultant_to_open_conversations
  AFTER UPDATE ON contacts
  FOR EACH ROW
  WHEN (
    NEW.consultant_id IS DISTINCT FROM OLD.consultant_id
    AND NEW.consultant_id IS NOT NULL
  )
  EXECUTE FUNCTION public.sync_consultant_to_open_conversations();
