
-- Add trigger_types array column to email_templates
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS trigger_types text[] DEFAULT '{}';

-- Migrate existing trigger_type values to trigger_types array
UPDATE public.email_templates 
SET trigger_types = ARRAY[trigger_type]
WHERE trigger_type IS NOT NULL AND trigger_type != '' AND (trigger_types IS NULL OR trigger_types = '{}');
