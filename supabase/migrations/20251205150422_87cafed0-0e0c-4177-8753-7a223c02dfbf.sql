-- FASE 1: Criar o Trigger de Distribuição Automática
CREATE OR REPLACE FUNCTION public.auto_distribute_client_on_playbook_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Só executa quando status muda para 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    v_result := public.distribute_client_to_consultant(NEW.contact_id);
    RAISE NOTICE 'Distribuição automática para contact_id %: %', NEW.contact_id, v_result;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Dropar trigger se existir e criar novo
DROP TRIGGER IF EXISTS trigger_distribute_on_playbook_complete ON public.playbook_executions;

CREATE TRIGGER trigger_distribute_on_playbook_complete
  AFTER UPDATE ON public.playbook_executions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_distribute_client_on_playbook_complete();

-- FASE 2: Melhorar Função de Seleção de Consultor (prioriza online, fallback para qualquer)
CREATE OR REPLACE FUNCTION public.get_least_loaded_consultant()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultant_id UUID;
BEGIN
  -- PRIORIDADE 1: Consultor ONLINE com menos clientes
  SELECT p.id INTO v_consultant_id
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.contacts c ON c.consultant_id = p.id AND c.status = 'customer'
  WHERE ur.role = 'consultant'
    AND p.availability_status = 'online'
  GROUP BY p.id
  ORDER BY COUNT(c.id) ASC, RANDOM()
  LIMIT 1;
  
  -- FALLBACK: Se nenhum online, pegar qualquer consultor
  IF v_consultant_id IS NULL THEN
    SELECT p.id INTO v_consultant_id
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON ur.user_id = p.id
    LEFT JOIN public.contacts c ON c.consultant_id = p.id AND c.status = 'customer'
    WHERE ur.role = 'consultant'
    GROUP BY p.id
    ORDER BY COUNT(c.id) ASC, RANDOM()
    LIMIT 1;
  END IF;
  
  RETURN v_consultant_id;
END;
$$;

-- FASE 3: Distribuir Clientes Pendentes (Retroativo)
DO $$
DECLARE
  r RECORD;
  v_result JSONB;
  v_count INT := 0;
BEGIN
  FOR r IN 
    SELECT DISTINCT pe.contact_id
    FROM playbook_executions pe
    JOIN contacts c ON c.id = pe.contact_id
    WHERE pe.status = 'completed'
      AND c.consultant_id IS NULL
  LOOP
    v_result := public.distribute_client_to_consultant(r.contact_id);
    v_count := v_count + 1;
    RAISE NOTICE 'Distribuído contact_id %: %', r.contact_id, v_result;
  END LOOP;
  
  RAISE NOTICE 'Total de clientes distribuídos retroativamente: %', v_count;
END $$;