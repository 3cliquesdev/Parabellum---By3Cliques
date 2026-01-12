-- Adicionar colunas para identificar clientes existentes e seus produtos
ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_returning_customer boolean DEFAULT false;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS existing_products jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN deals.is_returning_customer IS 'Indica se o lead ja e cliente existente com compras anteriores';
COMMENT ON COLUMN deals.existing_products IS 'Array de produtos que o cliente ja possui';