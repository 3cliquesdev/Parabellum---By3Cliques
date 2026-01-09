-- Trigger para pausar execuções automaticamente quando playbook é desativado
CREATE OR REPLACE FUNCTION pause_playbook_executions_on_deactivate()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando is_active muda de true para false
  IF NEW.is_active = false AND OLD.is_active = true THEN
    -- Cancelar execuções ativas
    UPDATE playbook_executions 
    SET status = 'cancelled', updated_at = NOW()
    WHERE playbook_id = NEW.id AND status = 'running';
    
    -- Cancelar itens na fila
    UPDATE playbook_execution_queue 
    SET status = 'cancelled'
    WHERE execution_id IN (
      SELECT id FROM playbook_executions 
      WHERE playbook_id = NEW.id
    ) AND status = 'pending';
    
    RAISE NOTICE 'Playbook % desativado: execuções canceladas', NEW.name;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger
DROP TRIGGER IF EXISTS on_playbook_deactivated ON onboarding_playbooks;
CREATE TRIGGER on_playbook_deactivated
AFTER UPDATE OF is_active ON onboarding_playbooks
FOR EACH ROW
EXECUTE FUNCTION pause_playbook_executions_on_deactivate();