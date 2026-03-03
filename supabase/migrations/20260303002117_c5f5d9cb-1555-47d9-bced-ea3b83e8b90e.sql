
-- Direct cleanup using a DO block (executes immediately as DDL)
DO $$
DECLARE
  affected integer;
BEGIN
  UPDATE public.contacts
  SET consultant_id = NULL
  WHERE consultant_id IS NOT NULL
    AND consultant_id NOT IN (
      SELECT user_id FROM public.user_roles WHERE role = 'consultant'
    );
  GET DIAGNOSTICS affected = ROW_COUNT;
  RAISE NOTICE 'Cleaned % contacts with invalid consultant_id', affected;
END;
$$;

-- Drop the cleanup function (no longer needed)
DROP FUNCTION IF EXISTS public.cleanup_invalid_consultant_ids();
