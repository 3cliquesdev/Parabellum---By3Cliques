-- Adicionar commission_rate e product goals à tabela sales_goals
ALTER TABLE sales_goals
ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS product_targets JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN sales_goals.commission_rate IS 'Taxa de comissão em % (ex: 5.00 = 5%)';
COMMENT ON COLUMN sales_goals.product_targets IS 'Array de sub-metas por produto: [{"product_id": "uuid", "product_name": "X", "target_quantity": 5, "current_quantity": 2}]';