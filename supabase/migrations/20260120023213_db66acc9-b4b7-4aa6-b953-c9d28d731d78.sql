-- Corrigir classificação da oferta "Associado Premium Ativo" para afiliado
UPDATE product_offers
SET source_type = 'afiliado'
WHERE offer_id = '4f042943-8133-4174-9e7d-5ac5e8c0e134'
AND is_active = true;

-- Atualizar QUALQUER outra oferta que tenha vendas com afiliados mas esteja incorreta
UPDATE product_offers po
SET source_type = 'afiliado'
WHERE po.is_active = true
AND po.source_type IN ('organico', 'unknown')
AND EXISTS (
  SELECT 1 FROM kiwify_events ke
  WHERE ke.event_type IN ('order_paid', 'subscription_renewed', 'subscription_created', 'paid')
  AND (ke.payload->'Subscription'->'plan'->>'id' = po.offer_id)
  AND ke.payload->'Commissions'->'commissioned_stores'->0->>'type' = 'affiliate'
);