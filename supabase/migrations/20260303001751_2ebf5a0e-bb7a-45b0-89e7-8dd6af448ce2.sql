
-- Create a function to clean invalid consultant IDs
CREATE OR REPLACE FUNCTION public.cleanup_invalid_consultant_ids()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE contacts
  SET consultant_id = NULL
  WHERE consultant_id IS NOT NULL
    AND consultant_id NOT IN (
      SELECT user_id FROM user_roles WHERE role = 'consultant'
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
