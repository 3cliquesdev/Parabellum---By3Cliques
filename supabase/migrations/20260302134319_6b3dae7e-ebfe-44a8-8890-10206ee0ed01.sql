
-- Trigger: auto-sync consultant_id when assigned_to is set but consultant_id is null
CREATE OR REPLACE FUNCTION sync_assigned_to_consultant_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Se assigned_to foi definido e consultant_id está vazio, sincronizar
  IF NEW.assigned_to IS NOT NULL AND NEW.consultant_id IS NULL THEN
    NEW.consultant_id := NEW.assigned_to;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_assigned_to_consultant_id ON contacts;

CREATE TRIGGER trg_sync_assigned_to_consultant_id
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION sync_assigned_to_consultant_id();

-- Backfill: fix all existing contacts with assigned_to but no consultant_id
UPDATE contacts 
SET consultant_id = assigned_to 
WHERE assigned_to IS NOT NULL AND consultant_id IS NULL;
