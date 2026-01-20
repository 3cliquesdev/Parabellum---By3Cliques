-- BACKFILL: Preencher closed_at para todos os deals "won" que não têm
UPDATE public.deals 
SET closed_at = created_at 
WHERE status = 'won' AND closed_at IS NULL;

-- TRIGGER: Garantir que deals marcados como "won" sempre tenham closed_at
CREATE OR REPLACE FUNCTION public.set_deal_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status está sendo alterado para "won" e closed_at está vazio
  IF NEW.status = 'won' AND NEW.closed_at IS NULL THEN
    NEW.closed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para INSERT e UPDATE
DROP TRIGGER IF EXISTS trigger_set_deal_closed_at ON public.deals;
CREATE TRIGGER trigger_set_deal_closed_at
  BEFORE INSERT OR UPDATE ON public.deals
  FOR EACH ROW
  EXECUTE FUNCTION public.set_deal_closed_at();