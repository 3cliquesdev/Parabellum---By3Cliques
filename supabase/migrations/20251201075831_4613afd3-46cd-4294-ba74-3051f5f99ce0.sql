-- Adicionar colunas para dados do afiliado
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS affiliate_name TEXT,
ADD COLUMN IF NOT EXISTS affiliate_email TEXT;

-- Estimar taxas Kiwify para deals sem valores reais
-- Taxa padrão Kiwify: 8.99% do valor bruto
UPDATE deals 
SET kiwify_fee = ROUND(gross_value * 0.0899, 2)
WHERE kiwify_fee IS NULL 
  AND gross_value IS NOT NULL
  AND (title ILIKE '%Kiwify%' OR title ILIKE '%Upsell%' OR title ILIKE '%Recuperação%');