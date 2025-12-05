-- 1. CORRIGIR: get_least_loaded_consultant - buscar role 'consultant' ao invés de 'sales_rep/manager'
CREATE OR REPLACE FUNCTION public.get_least_loaded_consultant()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultant_id UUID;
BEGIN
  -- Buscar consultor com papel 'consultant' que tenha menos clientes ativos
  SELECT p.id INTO v_consultant_id
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.contacts c ON c.consultant_id = p.id AND c.status = 'customer'
  WHERE ur.role = 'consultant'
  GROUP BY p.id
  ORDER BY COUNT(c.id) ASC, RANDOM()
  LIMIT 1;
  
  RETURN v_consultant_id;
END;
$$;

-- 2. CORRIGIR: distribute_client_to_consultant - verificar playbook_executions ao invés de customer_journey_steps
CREATE OR REPLACE FUNCTION public.distribute_client_to_consultant(p_contact_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact RECORD;
  v_playbook_completed BOOLEAN;
  v_target_consultant_id UUID;
  v_result JSONB;
BEGIN
  -- Buscar dados do contato
  SELECT * INTO v_contact
  FROM public.contacts
  WHERE id = p_contact_id;
  
  IF v_contact IS NULL THEN
    RAISE EXCEPTION 'Contato não encontrado';
  END IF;
  
  -- Verificar se existe playbook completado para este contato
  SELECT EXISTS (
    SELECT 1 
    FROM public.playbook_executions 
    WHERE contact_id = p_contact_id 
      AND status = 'completed'
  ) INTO v_playbook_completed;
  
  IF NOT v_playbook_completed THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Nenhum playbook de onboarding foi completado para este cliente'
    );
  END IF;
  
  -- PRIORIDADE 1: Sticky Agent (se já tem consultant_id, mantém)
  IF v_contact.consultant_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Cliente já possui consultor atribuído',
      'consultant_id', v_contact.consultant_id
    );
  END IF;
  
  -- PRIORIDADE 2: Sticky Agent via assigned_to (vendedor que fechou)
  IF v_contact.assigned_to IS NOT NULL THEN
    -- Verificar se o assigned_to é um consultor
    IF EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = v_contact.assigned_to AND role = 'consultant'
    ) THEN
      v_target_consultant_id := v_contact.assigned_to;
    ELSE
      -- Se não é consultor, usar round robin
      v_target_consultant_id := public.get_least_loaded_consultant();
    END IF;
  ELSE
    -- PRIORIDADE 3: Round Robin (consultor com menos clientes)
    v_target_consultant_id := public.get_least_loaded_consultant();
  END IF;
  
  IF v_target_consultant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Nenhum consultor disponível para atribuição'
    );
  END IF;
  
  -- Atribuir consultor ao cliente
  UPDATE public.contacts
  SET consultant_id = v_target_consultant_id,
      status = 'customer'
  WHERE id = p_contact_id;
  
  -- Registrar interação de atribuição
  INSERT INTO public.interactions (
    customer_id,
    type,
    content,
    channel,
    metadata
  ) VALUES (
    p_contact_id,
    'note',
    'Cliente atribuído a consultor após conclusão do onboarding',
    'other',
    jsonb_build_object(
      'consultant_id', v_target_consultant_id,
      'distribution_type', CASE 
        WHEN v_contact.assigned_to IS NOT NULL AND v_contact.assigned_to = v_target_consultant_id THEN 'sticky_agent'
        ELSE 'round_robin'
      END
    )
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'contact_id', p_contact_id,
    'consultant_id', v_target_consultant_id,
    'distribution_type', CASE 
      WHEN v_contact.assigned_to IS NOT NULL AND v_contact.assigned_to = v_target_consultant_id THEN 'sticky_agent'
      ELSE 'round_robin'
    END
  );
  
  RETURN v_result;
END;
$$;

-- 3. CRIAR: Função trigger para distribuição automática
CREATE OR REPLACE FUNCTION public.auto_distribute_client_on_playbook_complete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Só executar quando status muda para 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Tentar distribuir o cliente
    v_result := public.distribute_client_to_consultant(NEW.contact_id);
    
    -- Log do resultado (opcional - pode ser removido em produção)
    RAISE NOTICE 'Distribuição automática para contact_id %: %', NEW.contact_id, v_result;
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. CRIAR: Trigger na tabela playbook_executions
DROP TRIGGER IF EXISTS trigger_distribute_on_playbook_complete ON public.playbook_executions;

CREATE TRIGGER trigger_distribute_on_playbook_complete
AFTER UPDATE ON public.playbook_executions
FOR EACH ROW
EXECUTE FUNCTION public.auto_distribute_client_on_playbook_complete();

-- 5. DISTRIBUIÇÃO RETROATIVA: Atribuir consultores a clientes que já completaram onboarding
DO $$
DECLARE
  v_contact RECORD;
  v_result JSONB;
  v_count INTEGER := 0;
BEGIN
  -- Buscar todos os contatos que completaram playbook mas não têm consultor
  FOR v_contact IN
    SELECT DISTINCT c.id, c.first_name, c.email
    FROM public.contacts c
    INNER JOIN public.playbook_executions pe ON pe.contact_id = c.id
    WHERE pe.status = 'completed'
      AND c.consultant_id IS NULL
  LOOP
    -- Distribuir cada cliente
    v_result := public.distribute_client_to_consultant(v_contact.id);
    
    IF (v_result->>'success')::boolean THEN
      v_count := v_count + 1;
      RAISE NOTICE 'Cliente % (%) distribuído com sucesso', v_contact.first_name, v_contact.email;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Distribuição retroativa concluída: % clientes distribuídos', v_count;
END;
$$;