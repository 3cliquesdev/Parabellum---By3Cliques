-- Função para distribuir clientes sem consultor em lote via Round Robin
CREATE OR REPLACE FUNCTION public.distribute_unassigned_customers_batch(
  p_limit INTEGER DEFAULT 100
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultant_ids UUID[];
  v_consultant_count INTEGER;
  v_current_index INTEGER := 0;
  v_unassigned RECORD;
  v_assigned_count INTEGER := 0;
  v_results JSON;
BEGIN
  -- Busca consultores ativos (não bloqueados)
  SELECT ARRAY_AGG(p.id ORDER BY RANDOM())
  INTO v_consultant_ids
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'consultant'
    AND (p.blocked IS NULL OR p.blocked = false);
  
  v_consultant_count := COALESCE(array_length(v_consultant_ids, 1), 0);
  
  -- Se não há consultores, retorna erro
  IF v_consultant_count = 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Nenhum consultor ativo disponível',
      'assigned_count', 0
    );
  END IF;
  
  -- Distribui clientes sem consultor
  FOR v_unassigned IN
    SELECT id, first_name, last_name
    FROM contacts
    WHERE status = 'customer'
      AND consultant_id IS NULL
    ORDER BY created_at ASC
    LIMIT p_limit
  LOOP
    -- Atribui ao consultor atual no round robin
    UPDATE contacts
    SET consultant_id = v_consultant_ids[v_current_index + 1],
        last_contact_date = NOW()
    WHERE id = v_unassigned.id;
    
    -- Registra interação
    INSERT INTO customer_interactions (
      contact_id,
      interaction_type,
      notes,
      created_by
    ) VALUES (
      v_unassigned.id,
      'other',
      'Distribuição automática em lote via Round Robin',
      v_consultant_ids[v_current_index + 1]
    );
    
    v_assigned_count := v_assigned_count + 1;
    
    -- Avança para próximo consultor
    v_current_index := (v_current_index + 1) % v_consultant_count;
  END LOOP;
  
  RETURN json_build_object(
    'success', true,
    'message', format('%s clientes distribuídos com sucesso', v_assigned_count),
    'assigned_count', v_assigned_count,
    'consultants_used', v_consultant_count
  );
END;
$$;