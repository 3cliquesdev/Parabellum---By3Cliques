-- Tabela para armazenar submissões do formulário de onboarding
CREATE TABLE public.onboarding_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  knowledge_it INTEGER DEFAULT 0,
  knowledge_internet INTEGER DEFAULT 0,
  main_device TEXT,
  social_networks TEXT[],
  has_online_store BOOLEAN DEFAULT false,
  dropshipping_experience TEXT,
  platform_used TEXT,
  formalization TEXT,
  investment_budget TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.onboarding_submissions ENABLE ROW LEVEL SECURITY;

-- Permitir inserts públicos (formulário sem auth)
CREATE POLICY "Allow public inserts on onboarding_submissions"
  ON public.onboarding_submissions
  FOR INSERT
  WITH CHECK (true);

-- Leitura apenas para usuários autenticados
CREATE POLICY "Authenticated users can read onboarding_submissions"
  ON public.onboarding_submissions
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Atualização apenas para usuários autenticados
CREATE POLICY "Authenticated users can update onboarding_submissions"
  ON public.onboarding_submissions
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Deleção apenas para usuários autenticados
CREATE POLICY "Authenticated users can delete onboarding_submissions"
  ON public.onboarding_submissions
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Trigger para atualizar updated_at
CREATE TRIGGER update_onboarding_submissions_updated_at
  BEFORE UPDATE ON public.onboarding_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();