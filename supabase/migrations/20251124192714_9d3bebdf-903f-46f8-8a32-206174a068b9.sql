-- Fase 8A: Lost Reason Obrigatório
-- Adicionar coluna lost_reason na tabela deals
ALTER TABLE public.deals 
ADD COLUMN lost_reason TEXT;

-- Criar função de validação: lost_reason obrigatório se status = 'lost'
CREATE OR REPLACE FUNCTION public.validate_lost_reason()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'lost' AND (NEW.lost_reason IS NULL OR NEW.lost_reason = '') THEN
    RAISE EXCEPTION 'Motivo da perda é obrigatório ao marcar negócio como perdido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Criar trigger para validar lost_reason
CREATE TRIGGER enforce_lost_reason
BEFORE INSERT OR UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.validate_lost_reason();