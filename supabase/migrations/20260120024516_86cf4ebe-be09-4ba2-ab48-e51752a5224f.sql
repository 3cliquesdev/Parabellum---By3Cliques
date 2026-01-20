-- Recriar a view para incluir ofertas de produtos avulsos (Product.product_offer_id)
DROP VIEW IF EXISTS unmapped_kiwify_offers;

CREATE VIEW unmapped_kiwify_offers AS
WITH all_offers AS (
  -- Ofertas de assinaturas (Subscription.plan.id)
  SELECT DISTINCT
    ke.payload->'Subscription'->'plan'->>'id' as plan_id,
    ke.payload->'Subscription'->'plan'->>'name' as plan_name,
    ke.payload->'Product'->>'id' as kiwify_product_id,
    ke.payload->'Product'->>'name' as kiwify_product_name,
    CASE 
      WHEN ke.payload->'Commissions'->'commissioned_stores'->0->>'type' = 'affiliate' THEN 'afiliado'
      ELSE 'organico'
    END as detected_source_type
  FROM kiwify_events ke
  WHERE ke.event_type IN ('order_paid', 'subscription_renewed', 'subscription_created', 'paid')
  AND ke.payload->'Subscription'->'plan'->>'id' IS NOT NULL
  
  UNION ALL
  
  -- Ofertas de produtos avulsos (Product.product_offer_id)
  SELECT DISTINCT
    ke.payload->'Product'->>'product_offer_id' as plan_id,
    ke.payload->'Product'->>'product_offer_name' as plan_name,
    ke.payload->'Product'->>'id' as kiwify_product_id,
    ke.payload->'Product'->>'name' as kiwify_product_name,
    CASE 
      WHEN ke.payload->'Commissions'->'commissioned_stores'->0->>'type' = 'affiliate' THEN 'afiliado'
      ELSE 'organico'
    END as detected_source_type
  FROM kiwify_events ke
  WHERE ke.event_type IN ('order_paid', 'subscription_renewed', 'subscription_created', 'paid')
  AND ke.payload->'Product'->>'product_offer_id' IS NOT NULL
  AND ke.payload->'Subscription'->'plan'->>'id' IS NULL
),
offer_stats AS (
  SELECT 
    ao.plan_id,
    ao.plan_name,
    ao.kiwify_product_id,
    ao.kiwify_product_name,
    MAX(ao.detected_source_type) as detected_source_type,
    COUNT(*) as event_count,
    SUM(
      COALESCE(
        (ke.payload->>'order_value')::numeric,
        (ke.payload->'Subscription'->>'value')::numeric,
        0
      )
    ) as total_revenue
  FROM all_offers ao
  JOIN kiwify_events ke ON (
    ke.payload->'Subscription'->'plan'->>'id' = ao.plan_id
    OR ke.payload->'Product'->>'product_offer_id' = ao.plan_id
  )
  WHERE ke.event_type IN ('order_paid', 'subscription_renewed', 'subscription_created', 'paid')
  GROUP BY ao.plan_id, ao.plan_name, ao.kiwify_product_id, ao.kiwify_product_name
)
SELECT 
  os.plan_id,
  os.plan_name,
  os.kiwify_product_id,
  os.kiwify_product_name,
  os.detected_source_type,
  os.event_count,
  os.total_revenue
FROM offer_stats os
WHERE os.plan_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM product_offers po 
  WHERE po.offer_id = os.plan_id 
  AND po.is_active = true
)
ORDER BY os.event_count DESC;