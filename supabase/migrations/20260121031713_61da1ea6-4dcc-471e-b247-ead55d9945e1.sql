-- Corrigir source_type das ofertas comerciais (vendedoras + "Comercial" no nome)
-- Ofertas com nome de vendedoras ou "Comercial" devem ser source_type = 'comercial'

UPDATE product_offers
SET source_type = 'comercial', updated_at = now()
WHERE 
  source_type = 'organico'
  AND (
    offer_name ILIKE '%Thaynara%'
    OR offer_name ILIKE '%Loriane%'
    OR offer_name ILIKE '%Fernanda%'
    OR offer_name ILIKE '%Comercial%'
  );