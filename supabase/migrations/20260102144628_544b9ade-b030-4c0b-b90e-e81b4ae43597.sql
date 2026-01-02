-- Substituir trigger antigo por função SQL pura (sem dependência de Vault/Edge Functions)
DROP TRIGGER IF EXISTS on_deal_created_trigger ON public.deals;
DROP FUNCTION IF EXISTS public.trigger_deal_automations();

-- Criar função que faz distribuição Round-Robin diretamente no banco
CREATE OR REPLACE FUNCTION public.auto_assign_deal_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sales_rep_id UUID;
BEGIN
  -- Apenas atribuir se assigned_to estiver NULL
  IF NEW.assigned_to IS NULL THEN
    -- Buscar vendedor com menos deals abertos (mesma lógica de get_least_loaded_sales_rep)
    SELECT p.id INTO v_sales_rep_id
    FROM public.profiles p
    INNER JOIN public.user_roles ur ON ur.user_id = p.id
    LEFT JOIN public.deals d ON d.assigned_to = p.id AND d.status = 'open'
    WHERE ur.role = 'sales_rep'
      AND (p.is_blocked IS NULL OR p.is_blocked = false)
    GROUP BY p.id
    ORDER BY COUNT(d.id) ASC, RANDOM()
    LIMIT 1;
    
    -- Atribuir ao vendedor encontrado
    IF v_sales_rep_id IS NOT NULL THEN
      NEW.assigned_to := v_sales_rep_id;
      RAISE NOTICE '[auto_assign_deal] Deal % assigned to sales_rep %', NEW.id, v_sales_rep_id;
    ELSE
      RAISE NOTICE '[auto_assign_deal] No active sales_rep found for deal %', NEW.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger BEFORE INSERT (permite modificar NEW)
CREATE TRIGGER on_deal_created_auto_assign
  BEFORE INSERT ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_deal_on_insert();

-- Redistribuir deals antigos sem atribuição para vendedores ativos
WITH assigned_deals AS (
  SELECT 
    d.id as deal_id,
    (
      SELECT p.id
      FROM public.profiles p
      INNER JOIN public.user_roles ur ON ur.user_id = p.id
      LEFT JOIN public.deals d2 ON d2.assigned_to = p.id AND d2.status = 'open'
      WHERE ur.role = 'sales_rep'
        AND (p.is_blocked IS NULL OR p.is_blocked = false)
      GROUP BY p.id
      ORDER BY COUNT(d2.id) ASC, RANDOM()
      LIMIT 1
    ) as sales_rep_id
  FROM public.deals d
  WHERE d.status = 'open' 
    AND d.assigned_to IS NULL
)
UPDATE public.deals
SET assigned_to = ad.sales_rep_id
FROM assigned_deals ad
WHERE deals.id = ad.deal_id
  AND ad.sales_rep_id IS NOT NULL;