-- Corrige função distribute_clients_round_robin com colunas corretas da tabela interactions
CREATE OR REPLACE FUNCTION public.distribute_clients_round_robin(
  p_contact_ids UUID[],
  p_consultant_ids UUID[],
  p_source_consultant_name TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
  v_consultant_id UUID;
  v_consultant_index INT := 0;
  v_consultant_count INT;
  v_consultant_name TEXT;
  v_contact_name TEXT;
  v_distributed_count INT := 0;
BEGIN
  v_consultant_count := array_length(p_consultant_ids, 1);
  
  IF v_consultant_count IS NULL OR v_consultant_count = 0 THEN
    RETURN json_build_object('success', false, 'error', 'No consultants provided', 'distributed', 0);
  END IF;
  
  FOREACH v_contact_id IN ARRAY p_contact_ids
  LOOP
    v_consultant_id := p_consultant_ids[(v_consultant_index % v_consultant_count) + 1];
    
    SELECT full_name INTO v_consultant_name 
    FROM profiles 
    WHERE id = v_consultant_id;
    
    SELECT first_name || ' ' || last_name INTO v_contact_name 
    FROM contacts 
    WHERE id = v_contact_id;
    
    -- Atualiza contato com novo consultor
    UPDATE contacts 
    SET consultant_id = v_consultant_id
    WHERE id = v_contact_id;
    
    -- Registra interação com colunas CORRETAS
    INSERT INTO interactions (
      customer_id,
      type,
      content,
      channel,
      created_at,
      created_by
    ) VALUES (
      v_contact_id,
      'note',
      'Cliente transferido de ' || COALESCE(p_source_consultant_name, 'Não atribuído') || 
      ' para ' || COALESCE(v_consultant_name, 'Consultor') || ' (distribuição round-robin)',
      'internal',
      NOW(),
      v_consultant_id
    );
    
    v_distributed_count := v_distributed_count + 1;
    v_consultant_index := v_consultant_index + 1;
  END LOOP;
  
  RETURN json_build_object(
    'success', true, 
    'distributed', v_distributed_count,
    'consultants_used', v_consultant_count
  );
END;
$$;