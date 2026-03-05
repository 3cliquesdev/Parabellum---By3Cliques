
-- Add routing override columns to contacts
ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS preferred_agent_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS preferred_department_id uuid REFERENCES public.departments(id);

-- Add default department to organizations
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS default_department_id uuid REFERENCES public.departments(id);
