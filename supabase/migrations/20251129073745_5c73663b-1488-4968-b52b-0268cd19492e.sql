-- ============================================
-- SECURITY FIX: Remove public access to email_verifications
-- ============================================
-- Issue: Table exposes OTP codes and customer emails to anyone
-- Solution: Remove public SELECT policy, keep only service_role access

-- Drop the permissive public SELECT policy
DROP POLICY IF EXISTS "public_can_select_own_verifications" ON public.email_verifications;

-- Drop other permissive policies if they exist
DROP POLICY IF EXISTS "public_can_insert_verifications" ON public.email_verifications;
DROP POLICY IF EXISTS "public_can_update_verifications" ON public.email_verifications;

-- Create restrictive policy: NO public access at all
-- Only edge functions with service_role can access this table
CREATE POLICY "service_role_only_access" ON public.email_verifications
FOR ALL
USING (false)
WITH CHECK (false);

-- Add comment explaining the security model
COMMENT ON TABLE public.email_verifications IS 
'SECURITY: This table stores sensitive OTP codes and should NEVER be accessible to public/anon roles. Access only via Edge Functions using service_role key (send-verification-code, verify-code).';