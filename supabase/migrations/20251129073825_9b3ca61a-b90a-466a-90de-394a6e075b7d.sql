-- ============================================
-- SECURITY FIX: Remove public access to rate_limits
-- ============================================
-- Issue: Table exposes customer IP addresses and rate limiting infrastructure
-- Solution: Remove all public policies, access only via check_rate_limit function

-- Drop the permissive public policy
DROP POLICY IF EXISTS "system_can_manage_rate_limits" ON public.rate_limits;

-- Drop any other permissive policies if they exist
DROP POLICY IF EXISTS "public_can_select_rate_limits" ON public.rate_limits;
DROP POLICY IF EXISTS "public_can_insert_rate_limits" ON public.rate_limits;
DROP POLICY IF EXISTS "public_can_update_rate_limits" ON public.rate_limits;

-- Create restrictive policy: NO public/anon access
-- Only the check_rate_limit SECURITY DEFINER function can access this table
CREATE POLICY "service_role_only_access" ON public.rate_limits
FOR ALL
USING (false)
WITH CHECK (false);

-- Add comment explaining the security model
COMMENT ON TABLE public.rate_limits IS 
'SECURITY: This table stores IP addresses and rate limiting metadata. Should NEVER be accessible to public/anon roles. Access only via check_rate_limit() SECURITY DEFINER function.';