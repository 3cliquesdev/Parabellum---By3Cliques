-- Fix PUBLIC_DATA_EXPOSURE: forms_table_public_read
-- Drop public read policy for forms table
-- The form-public-api edge function uses SERVICE_ROLE_KEY to fetch forms,
-- so public form submissions will continue to work

DROP POLICY IF EXISTS "Anyone can view active forms" ON forms;

-- Fix PUBLIC_DATA_EXPOSURE: teams_table_public_read  
-- Drop public read policy for teams table
-- Teams should only be visible to authenticated users

DROP POLICY IF EXISTS "Anyone can view active teams" ON teams;

-- Add authenticated-only policy for teams if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'teams' 
    AND policyname = 'authenticated_can_view_teams'
  ) THEN
    EXECUTE 'CREATE POLICY "authenticated_can_view_teams" ON teams FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL)';
  END IF;
END $$;