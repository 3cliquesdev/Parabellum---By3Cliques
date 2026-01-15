-- Função para preencher closed_at automaticamente
CREATE OR REPLACE FUNCTION update_deal_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status mudou para won ou lost, definir closed_at
  IF (NEW.status IN ('won', 'lost') AND (OLD.status IS NULL OR OLD.status NOT IN ('won', 'lost'))) THEN
    NEW.closed_at = NOW();
  END IF;
  
  -- Se o status voltou para open, limpar closed_at
  IF (NEW.status = 'open' AND OLD.status IN ('won', 'lost')) THEN
    NEW.closed_at = NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para executar a função antes de updates
CREATE TRIGGER set_deal_closed_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_closed_at();

-- Preencher dados históricos: deals ganhos/perdidos sem closed_at
UPDATE deals 
SET closed_at = updated_at 
WHERE status IN ('won', 'lost') 
  AND closed_at IS NULL;