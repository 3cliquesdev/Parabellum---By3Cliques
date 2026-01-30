-- Trigger preventivo: corrige handoffs não completados
-- Se handoff_executed_at foi preenchido mas ai_mode ainda é autopilot, corrigir automaticamente

CREATE OR REPLACE FUNCTION fix_handoff_not_completed()
RETURNS TRIGGER AS $$
BEGIN
  -- Se handoff_executed_at foi preenchido mas ai_mode ainda é autopilot, corrigir
  IF NEW.handoff_executed_at IS NOT NULL 
     AND OLD.handoff_executed_at IS NULL
     AND NEW.ai_mode = 'autopilot' THEN
    NEW.ai_mode := 'waiting_human';
    NEW.dispatch_status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS trigger_fix_handoff_not_completed ON conversations;

-- Criar trigger
CREATE TRIGGER trigger_fix_handoff_not_completed
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION fix_handoff_not_completed();