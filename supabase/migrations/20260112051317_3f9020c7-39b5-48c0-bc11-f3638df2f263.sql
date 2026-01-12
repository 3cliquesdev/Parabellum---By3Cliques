-- Criar função melhorada de distribuição que respeita a equipe do pipeline
CREATE OR REPLACE FUNCTION public.get_least_loaded_sales_rep_for_pipeline(p_pipeline_id UUID DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_sales_rep_id UUID;
  v_has_team BOOLEAN;
BEGIN
  -- Verificar se o pipeline tem equipe configurada
  IF p_pipeline_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.pipeline_sales_reps 
      WHERE pipeline_id = p_pipeline_id
    ) INTO v_has_team;
  ELSE
    v_has_team := FALSE;
  END IF;

  IF v_has_team THEN
    -- Distribuir apenas entre membros da equipe do pipeline que estão online
    SELECT p.id INTO v_sales_rep_id
    FROM public.profiles p
    INNER JOIN public.pipeline_sales_reps psr ON psr.user_id = p.id
    INNER JOIN public.user_roles ur ON ur.user_id = p.id
    LEFT JOIN public.deals d ON d.assigned_to = p.id AND d.status = 'open'
    WHERE psr.pipeline_id = p_pipeline_id
      AND ur.role = 'sales_rep'
      AND p.availability_status = 'online'
    GROUP BY p.id
    ORDER BY COUNT(d.id) ASC, RANDOM()
    LIMIT 1;
    
    -- Se nenhum membro online, tentar membros offline da equipe
    IF v_sales_rep_id IS NULL THEN
      SELECT p.id INTO v_sales_rep_id
      FROM public.profiles p
      INNER JOIN public.pipeline_sales_reps psr ON psr.user_id = p.id
      INNER JOIN public.user_roles ur ON ur.user_id = p.id
      LEFT JOIN public.deals d ON d.assigned_to = p.id AND d.status = 'open'
      WHERE psr.pipeline_id = p_pipeline_id
        AND ur.role = 'sales_rep'
      GROUP BY p.id
      ORDER BY COUNT(d.id) ASC, RANDOM()
      LIMIT 1;
    END IF;
  ELSE
    -- Fallback: todos os sales_rep online (comportamento original)
    SELECT p.id INTO v_sales_rep_id
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON ur.user_id = p.id
    LEFT JOIN public.deals d ON d.assigned_to = p.id AND d.status = 'open'
    WHERE ur.role = 'sales_rep'
      AND p.availability_status = 'online'
    GROUP BY p.id
    ORDER BY COUNT(d.id) ASC, RANDOM()
    LIMIT 1;
    
    -- Fallback final: qualquer sales_rep se nenhum online
    IF v_sales_rep_id IS NULL THEN
      SELECT p.id INTO v_sales_rep_id
      FROM public.profiles p
      INNER JOIN public.user_roles ur ON ur.user_id = p.id
      LEFT JOIN public.deals d ON d.assigned_to = p.id AND d.status = 'open'
      WHERE ur.role = 'sales_rep'
      GROUP BY p.id
      ORDER BY COUNT(d.id) ASC, RANDOM()
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN v_sales_rep_id;
END;
$$;

-- Adicionar comentário explicativo
COMMENT ON FUNCTION public.get_least_loaded_sales_rep_for_pipeline(UUID) IS 
'Distribui negócios para o vendedor com menos deals abertos. 
Se pipeline_id é fornecido e o pipeline tem equipe configurada (pipeline_sales_reps), 
distribui apenas entre os membros dessa equipe. Caso contrário, usa todos os sales_rep.';