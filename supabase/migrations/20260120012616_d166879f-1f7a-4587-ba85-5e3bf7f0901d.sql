-- Dropar e recriar a view com o campo correto
DROP VIEW IF EXISTS unmapped_kiwify_offers;

CREATE OR REPLACE VIEW unmapped_kiwify_offers AS
SELECT DISTINCT
  payload->'Subscription'->'plan'->>'id' as plan_id,
  payload->'Subscription'->'plan'->>'name' as plan_name,
  payload->'Product'->>'product_id' as kiwify_product_id,
  payload->'Product'->>'product_name' as kiwify_product_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        COALESCE(payload->'Commissions'->'commissioned_stores', '[]'::jsonb)
      ) as store WHERE store->>'type' = 'affiliate'
    ) THEN 'afiliado'
    ELSE 'organico'
  END as detected_source_type,
  COUNT(*) as event_count,
  SUM((payload->>'product_base_price')::numeric / 100) as total_revenue
FROM kiwify_events
WHERE event_type IN ('paid', 'order_approved')
  AND created_at >= NOW() - INTERVAL '30 days'
  AND payload->'Subscription'->'plan'->>'id' IS NOT NULL
GROUP BY 1, 2, 3, 4, 5
HAVING payload->'Subscription'->'plan'->>'id' NOT IN (
  SELECT offer_id FROM product_offers WHERE offer_id IS NOT NULL
)
ORDER BY event_count DESC;