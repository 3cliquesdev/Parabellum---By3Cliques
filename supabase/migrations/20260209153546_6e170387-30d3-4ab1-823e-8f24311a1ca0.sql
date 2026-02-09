
-- 1. Criar função para incrementar execution_count
CREATE OR REPLACE FUNCTION public.increment_playbook_execution_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE onboarding_playbooks
  SET execution_count = execution_count + 1
  WHERE id = NEW.playbook_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Criar trigger
CREATE TRIGGER trg_increment_playbook_executions
AFTER INSERT ON playbook_executions
FOR EACH ROW
EXECUTE FUNCTION public.increment_playbook_execution_count();

-- 3. Sincronizar valores atuais
UPDATE onboarding_playbooks p
SET execution_count = (
  SELECT COUNT(*) FROM playbook_executions pe 
  WHERE pe.playbook_id = p.id
);
