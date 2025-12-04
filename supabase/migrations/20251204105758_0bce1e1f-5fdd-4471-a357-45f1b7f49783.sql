-- Add design_json column to email_templates for storing Unlayer editor design
ALTER TABLE public.email_templates 
ADD COLUMN IF NOT EXISTS design_json JSONB;