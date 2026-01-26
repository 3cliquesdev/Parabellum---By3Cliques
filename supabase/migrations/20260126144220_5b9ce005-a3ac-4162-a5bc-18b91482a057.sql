-- Fix Bug 3: Conversas perdendo atribuições a cada atualização
-- O trigger atual dispara em QUALQUER mudança de status, causando redistribuição indevida
-- A nova versão só redistribui se foi offline MANUAL (manual_offline = true)

CREATE OR REPLACE FUNCTION redistribute_on_agent_offline()
RETURNS TRIGGER AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Só redistribuir se:
  -- 1. O agente mudou de online para outro status
  -- 2. E foi uma ação MANUAL (manual_offline = true)
  -- Isso evita redistribuição por oscilações de conexão ou inatividade temporária
  IF OLD.availability_status = 'online' 
     AND NEW.availability_status != 'online' 
     AND NEW.manual_offline = true
  THEN
    -- Atualizar conversas abertas desse agente para fila (devolver para IA)
    UPDATE conversations
    SET 
      assigned_to = NULL,
      previous_agent_id = OLD.id,
      ai_mode = 'autopilot'
    WHERE 
      assigned_to = OLD.id 
      AND status = 'open';
    
    GET DIAGNOSTICS affected_count = ROW_COUNT;
    
    IF affected_count > 0 THEN
      RAISE NOTICE 'Redistributed % conversations from agent % going offline manually', affected_count, OLD.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover trigger se existir
DROP TRIGGER IF EXISTS on_agent_status_change ON profiles;

-- Recriar trigger com a função corrigida
CREATE TRIGGER on_agent_status_change
AFTER UPDATE OF availability_status ON profiles
FOR EACH ROW
EXECUTE FUNCTION redistribute_on_agent_offline();

-- Bug 8: Adicionar campo para mensagem citada (quoted message)
-- Isso permite rastrear quando o cliente responde a uma mensagem específica
ALTER TABLE messages ADD COLUMN IF NOT EXISTS quoted_message_id UUID REFERENCES messages(id);

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_messages_quoted_message_id ON messages(quoted_message_id) WHERE quoted_message_id IS NOT NULL;