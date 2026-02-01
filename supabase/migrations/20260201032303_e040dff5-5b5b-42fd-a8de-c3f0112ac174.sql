-- =====================================================
-- MIGRATION: Workspace Integrations Security Hardening
-- =====================================================

-- 1. Drop existing RLS policies to replace with stricter ones
DROP POLICY IF EXISTS "Users can view own workspace integrations" ON public.workspace_integrations;
DROP POLICY IF EXISTS "Admins can manage all integrations" ON public.workspace_integrations;
DROP POLICY IF EXISTS "Service role can manage integrations" ON public.workspace_integrations;

-- 2. Ensure RLS is enabled (block all direct client access)
ALTER TABLE public.workspace_integrations ENABLE ROW LEVEL SECURITY;

-- 3. Force RLS even for table owner (extra security layer)
ALTER TABLE public.workspace_integrations FORCE ROW LEVEL SECURITY;

-- 4. Create a single policy that blocks ALL client access
-- Access will ONLY be through Edge Functions using service role
CREATE POLICY "Block all direct access - use edge functions only"
ON public.workspace_integrations
FOR ALL
TO authenticated, anon
USING (false)
WITH CHECK (false);

-- 5. Update provider constraint to include all BYO providers
ALTER TABLE public.workspace_integrations 
DROP CONSTRAINT IF EXISTS workspace_integrations_provider_check;

-- Note: We don't add a CHECK constraint to allow flexibility for future providers

-- 6. Add index for faster lookups by provider
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_provider 
ON public.workspace_integrations(provider);

-- 7. Add index for workspace + provider lookups
CREATE INDEX IF NOT EXISTS idx_workspace_integrations_workspace_provider 
ON public.workspace_integrations(workspace_id, provider);

-- 8. Add comment explaining the security model
COMMENT ON TABLE public.workspace_integrations IS 
'Encrypted integration credentials. Direct access blocked by RLS. Use Edge Functions only (service role).';
