-- FASE 3: Distribution Engine
-- Adicionar campo consultant_id para separar sales rep (assigned_to) de consultor pós-venda

ALTER TABLE public.contacts
ADD COLUMN consultant_id UUID REFERENCES public.profiles(id);

CREATE INDEX idx_contacts_consultant_id ON public.contacts(consultant_id);

-- Função para calcular consultor com menos clientes ativos (Round Robin)
CREATE OR REPLACE FUNCTION public.get_least_loaded_consultant()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultant_id UUID;
BEGIN
  -- Buscar consultor com papel 'sales_rep' ou 'manager' que tenha menos clientes ativos
  SELECT p.id INTO v_consultant_id
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.contacts c ON c.consultant_id = p.id
  WHERE ur.role IN ('sales_rep', 'manager')
  GROUP BY p.id
  ORDER BY COUNT(c.id) ASC, RANDOM()
  LIMIT 1;
  
  RETURN v_consultant_id;
END;
$$;

-- Função para distribuir cliente ao consultor após onboarding completo
CREATE OR REPLACE FUNCTION public.distribute_client_to_consultant(p_contact_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact RECORD;
  v_all_steps_complete BOOLEAN;
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
  
  -- Verificar se todas as etapas críticas estão completas
  SELECT NOT EXISTS (
    SELECT 1 
    FROM public.customer_journey_steps 
    WHERE contact_id = p_contact_id 
      AND is_critical = true 
      AND completed = false
  ) INTO v_all_steps_complete;
  
  IF NOT v_all_steps_complete THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Nem todas as etapas críticas do onboarding foram completadas'
    );
  END IF;
  
  -- PRIORIDADE 1: Sticky Agent (se já tem assigned_to, usa como consultor)
  IF v_contact.assigned_to IS NOT NULL THEN
    v_target_consultant_id := v_contact.assigned_to;
  ELSE
    -- PRIORIDADE 2: Round Robin (consultor com menos clientes)
    v_target_consultant_id := public.get_least_loaded_consultant();
  END IF;
  
  IF v_target_consultant_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum consultor disponível para atribuição';
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
        WHEN v_contact.assigned_to IS NOT NULL THEN 'sticky_agent'
        ELSE 'round_robin'
      END
    )
  );
  
  v_result := jsonb_build_object(
    'success', true,
    'contact_id', p_contact_id,
    'consultant_id', v_target_consultant_id,
    'distribution_type', CASE 
      WHEN v_contact.assigned_to IS NOT NULL THEN 'sticky_agent'
      ELSE 'round_robin'
    END
  );
  
  RETURN v_result;
END;
$$;