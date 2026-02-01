-- Add instagram to allowed providers
ALTER TABLE public.workspace_integrations
DROP CONSTRAINT workspace_integrations_provider_check;

ALTER TABLE public.workspace_integrations
ADD CONSTRAINT workspace_integrations_provider_check 
CHECK (provider = ANY (ARRAY['whatsapp_meta'::text, 'email'::text, 'kiwify'::text, 'instagram'::text]));

-- Add active status
ALTER TABLE public.workspace_integrations
DROP CONSTRAINT workspace_integrations_status_check;

ALTER TABLE public.workspace_integrations
ADD CONSTRAINT workspace_integrations_status_check 
CHECK (status = ANY (ARRAY['connected'::text, 'disconnected'::text, 'error'::text, 'pending'::text, 'active'::text]));