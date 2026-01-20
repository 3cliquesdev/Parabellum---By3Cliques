-- Corrigir classificação de vendas históricas: Afiliado vs Orgânica
-- Vendas com affiliate_commission > 0 são de afiliados, não orgânicas

UPDATE deals
SET 
  title = REPLACE(title, 'Venda Orgânica', 'Venda Afiliado'),
  is_organic_sale = false,
  updated_at = now()
WHERE affiliate_commission > 0
  AND affiliate_commission IS NOT NULL
  AND (title LIKE 'Venda Orgânica%' OR is_organic_sale = true);

-- Também corrigir recorrências com afiliados
UPDATE deals
SET 
  is_organic_sale = false,
  updated_at = now()
WHERE affiliate_commission > 0
  AND affiliate_commission IS NOT NULL
  AND title LIKE 'Recorrência%'
  AND is_organic_sale = true;