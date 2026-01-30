-- Corrigir trigger redistribute_on_agent_offline
-- CONTRATO v2.2 §7: Conversas NÃO são redistribuídas para autopilot
-- Comportamento correto: mover para waiting_human (fila humana)

CREATE OR REPLACE FUNCTION redistribute_on_agent_offline()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando agente fica offline, mover conversas para fila humana
  -- CONTRATO v2.2 §1: Mudar status NUNCA encerra conversas
  -- CONTRATO v2.2 §7: Conversas NÃO são redistribuídas automaticamente (para IA)
  IF NEW.availability_status = 'offline' AND OLD.availability_status != 'offline' THEN
    UPDATE conversations
    SET 
      assigned_to = NULL,
      previous_agent_id = OLD.id,
      -- §7: Todas vão para fila humana, NUNCA para autopilot
      ai_mode = 'waiting_human',
      dispatch_status = 'pending'
    WHERE assigned_to = OLD.id AND status = 'open';
    
    -- Log para auditoria
    RAISE NOTICE 'Agent % went offline: conversations moved to waiting_human queue', OLD.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Garantir que o trigger existe
DROP TRIGGER IF EXISTS trigger_redistribute_on_agent_offline ON profiles;

CREATE TRIGGER trigger_redistribute_on_agent_offline
  AFTER UPDATE OF availability_status ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION redistribute_on_agent_offline();