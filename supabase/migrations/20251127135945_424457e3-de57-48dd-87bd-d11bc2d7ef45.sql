-- FASE 1: Add external_id to products table for Kiwify mapping

-- Add external_id column
ALTER TABLE products ADD COLUMN external_id TEXT;

-- Create unique index to prevent duplicate Kiwify IDs
CREATE UNIQUE INDEX idx_products_external_id 
ON products(external_id) 
WHERE external_id IS NOT NULL;

-- Add comment
COMMENT ON COLUMN products.external_id IS 'ID externo da Kiwify (ex: Kyw8921abc) para mapping automático no webhook';