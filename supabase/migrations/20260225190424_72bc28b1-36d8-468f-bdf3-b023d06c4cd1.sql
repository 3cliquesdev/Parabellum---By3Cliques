
-- Fix: conversations table does not have updated_at column
-- Remove that reference from the sync trigger
CREATE OR REPLACE FUNCTION public.sync_consultant_to_open_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_conv RECORD;
BEGIN
  FOR updated_conv IN
    UPDATE conversations
    SET assigned_to = NEW.consultant_id,
        ai_mode = 'copilot'
    WHERE contact_id = NEW.id
      AND status = 'open'
      AND assigned_to IS NULL
    RETURNING id
  LOOP
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
