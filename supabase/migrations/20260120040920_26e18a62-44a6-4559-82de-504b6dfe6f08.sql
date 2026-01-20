-- Parte 1: Adicionar coluna kiwify_product_id para mapeamento por product_id
ALTER TABLE product_offers 
ADD COLUMN IF NOT EXISTS kiwify_product_id TEXT;

-- Índice para lookup rápido por product_id
CREATE INDEX IF NOT EXISTS idx_product_offers_kiwify_product_id 
ON product_offers(kiwify_product_id) WHERE kiwify_product_id IS NOT NULL;

-- Parte 2: Recriar view para incluir produtos que só têm product_id
DROP VIEW IF EXISTS unmapped_kiwify_offers;

CREATE VIEW unmapped_kiwify_offers AS
WITH offer_aggregates AS (
  SELECT 
    -- Prioridade: offer_id > product_id (fallback)
    COALESCE(
      payload->'Subscription'->'plan'->>'id',
      payload->'Product'->>'product_offer_id',
      payload->'Product'->>'product_id'
    ) as plan_id,
    COALESCE(
      payload->'Subscription'->'plan'->>'name',
      payload->'Product'->>'product_offer_name',
      payload->'Product'->>'product_name'
    ) as plan_name,
    payload->'Product'->>'product_id' as kiwify_product_id,
    payload->'Product'->>'product_name' as kiwify_product_name,
    -- Detectar se é afiliado ou orgânico
    CASE 
      WHEN payload->'Commissions'->'commissioned_stores'->0->>'type' = 'affiliate' 
      THEN 'afiliado'
      ELSE 'organico'
    END as detected_source_type,
    -- Receita
    COALESCE(
      (payload->>'order_value')::numeric,
      (payload->'Subscription'->>'value')::numeric,
      0
    ) as revenue
  FROM kiwify_events
  WHERE event_type IN ('paid', 'order_paid', 'order_approved')
)
SELECT 
  plan_id,
  MAX(plan_name) as plan_name,
  MAX(kiwify_product_id) as kiwify_product_id,
  MAX(kiwify_product_name) as kiwify_product_name,
  MAX(detected_source_type) as detected_source_type,
  COUNT(*) as event_count,
  SUM(revenue) as total_revenue
FROM offer_aggregates
WHERE plan_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM product_offers po 
    WHERE po.is_active = true
      AND (
        po.offer_id = plan_id 
        OR po.kiwify_product_id = plan_id
      )
  )
GROUP BY plan_id
ORDER BY event_count DESC;