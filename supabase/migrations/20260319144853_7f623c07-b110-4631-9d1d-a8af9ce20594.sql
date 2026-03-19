ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS product_items jsonb DEFAULT NULL;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS seller_name text DEFAULT NULL;