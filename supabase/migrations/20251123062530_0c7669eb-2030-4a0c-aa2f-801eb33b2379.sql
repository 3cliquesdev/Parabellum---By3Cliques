-- Create forms table
CREATE TABLE public.forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  schema JSONB NOT NULL DEFAULT '{"fields": []}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.forms ENABLE ROW LEVEL SECURITY;

-- Policies for forms (authenticated users can manage)
CREATE POLICY "Authenticated users can view forms"
  ON public.forms FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create forms"
  ON public.forms FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update forms"
  ON public.forms FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete forms"
  ON public.forms FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- Allow public access to active forms (for viewing)
CREATE POLICY "Anyone can view active forms"
  ON public.forms FOR SELECT
  USING (is_active = true);

-- Allow public INSERT on contacts table (for form submissions)
CREATE POLICY "Public can create contacts via forms"
  ON public.contacts FOR INSERT
  WITH CHECK (true);

-- Trigger for updated_at
CREATE TRIGGER update_forms_updated_at
  BEFORE UPDATE ON public.forms
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();