-- Add routing fields to forms table for Web-to-Lead functionality

-- Create enum for target type
DO $$ BEGIN
  CREATE TYPE form_target_type AS ENUM ('deal', 'ticket', 'internal_request');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create enum for distribution rule
DO $$ BEGIN
  CREATE TYPE form_distribution_rule AS ENUM ('round_robin', 'manager_only', 'specific_user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to forms table
ALTER TABLE public.forms
ADD COLUMN IF NOT EXISTS target_type form_target_type DEFAULT 'deal',
ADD COLUMN IF NOT EXISTS target_department_id uuid REFERENCES public.departments(id),
ADD COLUMN IF NOT EXISTS target_pipeline_id uuid REFERENCES public.pipelines(id),
ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS distribution_rule form_distribution_rule DEFAULT 'round_robin',
ADD COLUMN IF NOT EXISTS notify_manager boolean DEFAULT true;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_forms_target_department ON public.forms(target_department_id);
CREATE INDEX IF NOT EXISTS idx_forms_target_pipeline ON public.forms(target_pipeline_id);

-- Add comment for documentation
COMMENT ON COLUMN public.forms.target_type IS 'What to create when form is submitted: deal, ticket, or internal_request';
COMMENT ON COLUMN public.forms.distribution_rule IS 'How to distribute: round_robin (distribute equally), manager_only (send to manager), specific_user (fixed user)';