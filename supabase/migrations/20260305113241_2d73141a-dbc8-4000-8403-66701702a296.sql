
-- Hardening: upgrade validate_deal_sales_channel (VOLATILE, ERRCODE, btrim, REVOKE)

-- A) Reusar trigger updated_at padrão (idempotente)
DROP TRIGGER IF EXISTS trg_sales_channels_updated_at ON public.sales_channels;
DROP TRIGGER IF EXISTS update_sales_channels_updated_at ON public.sales_channels;
DROP FUNCTION IF EXISTS public.update_sales_channels_updated_at();

CREATE TRIGGER update_sales_channels_updated_at
  BEFORE UPDATE ON public.sales_channels
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- B) Função de validação melhorada
CREATE OR REPLACE FUNCTION public.validate_deal_sales_channel()
RETURNS TRIGGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sales_channel_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.sales_channels sc
      WHERE sc.id = NEW.sales_channel_id
        AND sc.requires_order_id = true
    )
    AND (NEW.external_order_id IS NULL OR btrim(NEW.external_order_id) = '') THEN
      RAISE EXCEPTION
        USING
          ERRCODE = '23514',
          MESSAGE = 'O canal de venda selecionado exige um ID de venda (external_order_id)';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_deal_sales_channel() FROM PUBLIC;

-- C) Trigger idempotente em deals
DROP TRIGGER IF EXISTS trg_validate_deal_sales_channel ON public.deals;

CREATE TRIGGER trg_validate_deal_sales_channel
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_deal_sales_channel();
