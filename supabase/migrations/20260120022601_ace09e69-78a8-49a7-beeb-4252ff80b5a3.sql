-- Atualizar ofertas Guilherme Cirilo que estão como 'unknown' para 'afiliado'
UPDATE product_offers
SET source_type = 'afiliado'
WHERE offer_id IN (
  '02f441c0-9d72-11f0-8c06-79ea52dfcf7e',
  '9239cf85-bb49-4627-b065-3d753d56c2fa'
)
AND (source_type = 'unknown' OR source_type IS NULL);

-- Auto-detectar source_type para TODAS as ofertas 'unknown' baseado no payload real
UPDATE product_offers po
SET source_type = CASE 
  WHEN EXISTS (
    SELECT 1 FROM kiwify_events ke
    WHERE (ke.payload->'Subscription'->'plan'->>'id' = po.offer_id
       OR ke.payload->'Product'->>'offer_id' = po.offer_id)
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(
        COALESCE(ke.payload->'Commissions'->'commissioned_stores', '[]'::jsonb)
      ) as store WHERE store->>'type' = 'affiliate'
    )
  ) THEN 'afiliado'
  ELSE 'organico'
END
WHERE source_type = 'unknown' OR source_type IS NULL;