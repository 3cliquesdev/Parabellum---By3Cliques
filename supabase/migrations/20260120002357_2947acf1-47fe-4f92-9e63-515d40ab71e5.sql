-- Fase 1: Adicionar coluna source_type para classificação de ofertas
ALTER TABLE product_offers ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'unknown';

-- Fase 2: Inserir mapeamentos das ofertas confirmadas pelo usuário
-- Usando Subscription.plan.id para assinaturas
INSERT INTO product_offers (product_id, offer_id, offer_name, source, source_type, is_active)
VALUES 
  -- Afiliado: Guilherme Cirilo
  ((SELECT id FROM products WHERE name = 'Associado Premium'), 
   '9b5b202f-2735-4d14-906f-fa24c5ec6e09', 
   'Oferta Guilherme Cirilo', 
   'kiwify', 'afiliado', true),
  
  -- Afiliado: Order Bump Parceiros  
  ((SELECT id FROM products WHERE name = 'Associado Premium'), 
   '5c8c6c69-db5b-4f28-9929-5bccc70e94c7', 
   'Order Bump Parceiros', 
   'kiwify', 'afiliado', true),
  
  -- Orgânico: Associado Premium Ativo
  ((SELECT id FROM products WHERE name = 'Associado Premium'), 
   '4f042943-8133-4174-9e7d-5ac5e8c0e134', 
   'Associado Premium Ativo', 
   'kiwify', 'organico', true),
  
  -- Comercial: Fernanda Venda Mensal (Time Comercial)
  ((SELECT id FROM products WHERE name = 'Associado Premium'), 
   '84947aee-dc08-4a51-956c-4ee8b49e328a', 
   'Fernanda Venda Mensal', 
   'kiwify', 'comercial', true),
  
  -- Orgânico: Mensal - Página de Vendas
  ((SELECT id FROM products WHERE name = 'Associado Premium'), 
   'bd3a5ebf-43db-439e-a50d-ab21227859df', 
   'Mensal - Página de Vendas', 
   'kiwify', 'organico', true)
ON CONFLICT (product_id, offer_id) DO UPDATE SET 
  source_type = EXCLUDED.source_type,
  offer_name = EXCLUDED.offer_name;

-- Fase 3: Criar view para ofertas não mapeadas (últimos 30 dias)
CREATE OR REPLACE VIEW unmapped_kiwify_offers AS
SELECT DISTINCT
  payload->'Subscription'->'plan'->>'id' as plan_id,
  payload->'Subscription'->'plan'->>'name' as plan_name,
  payload->'Product'->>'product_id' as kiwify_product_id,
  payload->'Product'->>'name' as kiwify_product_name,
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