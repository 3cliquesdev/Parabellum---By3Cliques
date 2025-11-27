-- FASE 1: Criar Stage "Recuperação" no Pipeline
DO $$
DECLARE
  v_default_pipeline_id UUID;
BEGIN
  -- Pegar o primeiro pipeline (ou criar um se não existir)
  SELECT id INTO v_default_pipeline_id FROM pipelines LIMIT 1;
  
  IF v_default_pipeline_id IS NULL THEN
    INSERT INTO pipelines (name, is_default) 
    VALUES ('Funil Principal', true)
    RETURNING id INTO v_default_pipeline_id;
  END IF;
  
  -- Criar stage "Recuperação" na posição 0 (primeira etapa)
  INSERT INTO stages (name, pipeline_id, position)
  VALUES ('Recuperação', v_default_pipeline_id, 0)
  ON CONFLICT DO NOTHING;
END $$;

-- FASE 1.2: Adicionar campos Kiwify na tabela contacts
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS kiwify_customer_id TEXT,
ADD COLUMN IF NOT EXISTS kiwify_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS last_kiwify_event TEXT,
ADD COLUMN IF NOT EXISTS last_kiwify_event_at TIMESTAMPTZ;

-- FASE 1.3: Criar índices para busca otimizada
CREATE INDEX IF NOT EXISTS idx_contacts_kiwify_customer_id ON contacts(kiwify_customer_id);
CREATE INDEX IF NOT EXISTS idx_contacts_last_kiwify_event ON contacts(last_kiwify_event);

-- FASE 2: Função de Round Robin para Sales Reps
CREATE OR REPLACE FUNCTION public.get_least_loaded_sales_rep()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sales_rep_id UUID;
BEGIN
  -- Buscar sales_rep online com menor número de deals abertos
  SELECT p.id INTO v_sales_rep_id
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  LEFT JOIN public.deals d ON d.assigned_to = p.id AND d.status = 'open'
  WHERE ur.role = 'sales_rep'
    AND p.availability_status = 'online'
  GROUP BY p.id
  ORDER BY COUNT(d.id) ASC, RANDOM()
  LIMIT 1;
  
  -- Se nenhum sales_rep online, retornar NULL (irá para fila)
  RETURN v_sales_rep_id;
END;
$function$;