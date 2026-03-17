-- Drop the previous version that tried to use vault
DROP FUNCTION IF EXISTS public.custom_auth_email_hook(jsonb);

-- Create the auth email hook function using pg_net
CREATE OR REPLACE FUNCTION public.custom_auth_email_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  request_id bigint;
  project_url text := 'https://zaeozfdjhrmblfaxsyuu.supabase.co';
BEGIN
  -- Fire-and-forget HTTP call to our edge function
  SELECT net.http_post(
    url := project_url || '/functions/v1/auth-email-hook',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW96ZmRqaHJtYmxmYXhzeXV1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzg3NzE4MiwiZXhwIjoyMDc5NDUzMTgyfQ.kUuB9elBGnPXIWW17LFurHUOVLQj4qDllMUUx4_Mmx8'
    ),
    body := event
  ) INTO request_id;

  -- Return the event unchanged to tell Supabase Auth we handled it
  RETURN event;
END;
$$;

-- Grant to supabase_auth_admin so auth system can call it
GRANT EXECUTE ON FUNCTION public.custom_auth_email_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_auth_email_hook(jsonb) FROM authenticated, anon, public;