
-- 1. Add new columns to sales_channels
ALTER TABLE public.sales_channels 
  ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS description text NULL;

-- 2. Trigger for updated_at on sales_channels
CREATE OR REPLACE FUNCTION public.update_sales_channels_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sales_channels_updated_at
  BEFORE UPDATE ON public.sales_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_sales_channels_updated_at();

-- 3. Performance index
CREATE INDEX IF NOT EXISTS idx_sales_channels_active_sort 
  ON public.sales_channels (is_active, sort_order, name);

-- 4. Add dedicated audit columns to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS sales_channel_id uuid NULL REFERENCES public.sales_channels(id),
  ADD COLUMN IF NOT EXISTS sales_channel_name text NULL,
  ADD COLUMN IF NOT EXISTS external_order_id text NULL,
  ADD COLUMN IF NOT EXISTS company_contact_id uuid NULL REFERENCES public.contacts(id),
  ADD COLUMN IF NOT EXISTS company_name_snapshot text NULL;
