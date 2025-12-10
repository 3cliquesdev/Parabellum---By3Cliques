
-- Tabela para rastrear progresso do onboarding administrativo
CREATE TABLE public.admin_onboarding_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
  completed_at TIMESTAMPTZ,
  validated_by TEXT CHECK (validated_by IN ('auto', 'manual', 'ai')),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, step_key)
);

-- Adicionar campos de onboarding em profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS onboarding_progress INTEGER DEFAULT 0;

-- Índices para performance
CREATE INDEX idx_admin_onboarding_user ON public.admin_onboarding_steps(user_id);
CREATE INDEX idx_admin_onboarding_status ON public.admin_onboarding_steps(status);

-- Enable RLS
ALTER TABLE public.admin_onboarding_steps ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view own onboarding steps"
ON public.admin_onboarding_steps FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own onboarding steps"
ON public.admin_onboarding_steps FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own onboarding steps"
ON public.admin_onboarding_steps FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Admin can view all onboarding steps"
ON public.admin_onboarding_steps FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_admin_onboarding_steps_updated_at
BEFORE UPDATE ON public.admin_onboarding_steps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular progresso
CREATE OR REPLACE FUNCTION public.calculate_onboarding_progress(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_steps INTEGER := 6;
  completed_steps INTEGER;
  progress INTEGER;
BEGIN
  SELECT COUNT(*) INTO completed_steps
  FROM admin_onboarding_steps
  WHERE user_id = p_user_id AND status = 'completed';
  
  progress := ROUND((completed_steps::NUMERIC / total_steps::NUMERIC) * 100);
  
  -- Atualizar profile
  UPDATE profiles
  SET onboarding_progress = progress,
      onboarding_completed = (progress = 100),
      onboarding_completed_at = CASE WHEN progress = 100 THEN now() ELSE NULL END
  WHERE id = p_user_id;
  
  RETURN progress;
END;
$$;
