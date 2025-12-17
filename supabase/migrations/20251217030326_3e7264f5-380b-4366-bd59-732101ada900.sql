-- Add support_phone field to onboarding_playbooks for WhatsApp button configuration
ALTER TABLE public.onboarding_playbooks 
ADD COLUMN IF NOT EXISTS support_phone TEXT DEFAULT '5511999999999';

-- Add comment explaining the field
COMMENT ON COLUMN public.onboarding_playbooks.support_phone IS 'WhatsApp phone number for support button on public playbook pages';