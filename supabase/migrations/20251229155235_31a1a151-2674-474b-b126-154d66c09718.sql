-- Trigger para impedir remoção de evidências de tickets
-- Uma vez que evidências são anexadas, não podem ser removidas

CREATE OR REPLACE FUNCTION public.prevent_ticket_evidence_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o ticket já tinha attachments e está tentando diminuir o array
  IF OLD.attachments IS NOT NULL 
     AND jsonb_array_length(OLD.attachments) > 0 
     AND (NEW.attachments IS NULL OR jsonb_array_length(NEW.attachments) < jsonb_array_length(OLD.attachments))
  THEN
    RAISE EXCEPTION 'Não é permitido remover evidências de tickets. Evidências são imutáveis após upload.';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Criar trigger na tabela tickets
DROP TRIGGER IF EXISTS ticket_evidence_protection ON public.tickets;

CREATE TRIGGER ticket_evidence_protection
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.prevent_ticket_evidence_removal();