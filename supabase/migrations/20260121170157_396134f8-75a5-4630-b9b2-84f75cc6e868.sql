-- Atualizar a função para permitir remoção de evidências em tickets abertos
-- Mantém proteção apenas para tickets fechados/resolvidos
CREATE OR REPLACE FUNCTION public.prevent_ticket_evidence_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Permitir remoção de evidências em tickets abertos/em andamento
  -- A auditoria é feita via ticket_events pela aplicação
  -- Apenas bloquear em tickets já fechados/resolvidos
  IF (OLD.status = 'closed' OR OLD.status = 'resolved')
     AND OLD.attachments IS NOT NULL 
     AND jsonb_array_length(OLD.attachments) > 0 
     AND (NEW.attachments IS NULL OR jsonb_array_length(NEW.attachments) < jsonb_array_length(OLD.attachments))
  THEN
    RAISE EXCEPTION 'Não é permitido remover evidências de tickets já fechados ou resolvidos.';
  END IF;
  
  RETURN NEW;
END;
$$;