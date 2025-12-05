-- Simplificar função de distribuição - remover priorização por status online
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