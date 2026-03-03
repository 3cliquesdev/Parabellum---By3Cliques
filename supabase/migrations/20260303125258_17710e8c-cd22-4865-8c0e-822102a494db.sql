CREATE OR REPLACE FUNCTION sync_assigned_to_consultant_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.consultant_id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = NEW.assigned_to AND role = 'consultant'
    ) THEN
      NEW.consultant_id := NEW.assigned_to;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;