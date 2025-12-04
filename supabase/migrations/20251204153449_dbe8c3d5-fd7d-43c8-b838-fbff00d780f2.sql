-- FASE 1: Central de Branding de Email
CREATE TABLE public.email_branding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  header_color TEXT DEFAULT '#1e3a5f',
  primary_color TEXT DEFAULT '#2563eb',
  footer_text TEXT DEFAULT 'Equipe de Suporte',
  footer_logo_url TEXT,
  is_default_customer BOOLEAN DEFAULT false,
  is_default_employee BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- FASE 3: Remetentes por Departamento
CREATE TABLE public.email_senders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  from_name TEXT NOT NULL,
  from_email TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Expandir email_templates com vínculos
ALTER TABLE public.email_templates 
ADD COLUMN IF NOT EXISTS branding_id UUID REFERENCES public.email_branding(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.email_senders(id) ON DELETE SET NULL;

-- Enable RLS
ALTER TABLE public.email_branding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_senders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_branding
CREATE POLICY "admin_manager_can_manage_email_branding"
ON public.email_branding FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "authenticated_can_view_email_branding"
ON public.email_branding FOR SELECT
USING (auth.uid() IS NOT NULL);

-- RLS Policies for email_senders
CREATE POLICY "admin_manager_can_manage_email_senders"
ON public.email_senders FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "authenticated_can_view_email_senders"
ON public.email_senders FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Insert default branding for "Seu Armazém Drop"
INSERT INTO public.email_branding (name, header_color, primary_color, footer_text, is_default_customer)
VALUES ('Seu Armazém Drop', '#1e3a5f', '#2563eb', 'Seu Armazém Drop - Equipe de Suporte', true);

-- Insert default branding for internal
INSERT INTO public.email_branding (name, header_color, primary_color, footer_text, is_default_employee)
VALUES ('PARABELLUM | 3Cliques', '#0f172a', '#3b82f6', 'PARABELLUM | 3Cliques - Sistema Interno', true);

-- Create updated_at trigger
CREATE TRIGGER update_email_branding_updated_at
BEFORE UPDATE ON public.email_branding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_senders_updated_at
BEFORE UPDATE ON public.email_senders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();