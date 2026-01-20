-- PARTE A: Curar dados existentes onde kiwify_product_id deveria estar preenchido
-- Cenário: offer_id foi salvo com o valor do product_id, mas kiwify_product_id ficou NULL

UPDATE product_offers po
SET 
  kiwify_product_id = po.offer_id,
  updated_at = now()
WHERE po.is_active = true
  AND po.kiwify_product_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM kiwify_events ke
    WHERE ke.event_type IN ('paid', 'order_approved')
      AND (ke.payload->'Product'->>'product_id') = po.offer_id
      AND (ke.payload->'Subscription'->'plan'->>'id') IS NULL
      AND (ke.payload->'Product'->>'product_offer_id') IS NULL
  );