-- Corrigir função get_least_loaded_consultant para excluir consultores bloqueados
CREATE OR REPLACE FUNCTION public.get_least_loaded_consultant()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_consultant_id UUID;
BEGIN
  -- Distribuir para consultor com MENOS clientes (independente de status online/offline)
  -- IMPORTANTE: Excluir consultores bloqueados (is_blocked = true)
  SELECT p.id INTO v_consultant_id
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role = 'consultant'
    AND (p.is_blocked IS NULL OR p.is_blocked = false) -- Excluir bloqueados
  ORDER BY (
    SELECT COUNT(*) 
    FROM public.contacts c 
    WHERE c.consultant_id = p.id 
      AND c.status = 'customer'
  ) ASC,
  RANDOM() -- Desempate aleatório
  LIMIT 1;
  
  RETURN v_consultant_id;
END;
$$;