-- FASE 1: Criar Tabela de Macros (Respostas Prontas)
CREATE TABLE public.canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  shortcut TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id),
  created_by UUID REFERENCES auth.users(id) NOT NULL DEFAULT auth.uid(),
  is_public BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

-- Policy SELECT: Ver macros próprias + públicas (do seu departamento ou globais)
CREATE POLICY "select_canned_responses" ON public.canned_responses
FOR SELECT USING (
  created_by = auth.uid() 
  OR (
    is_public = true 
    AND (
      department_id IS NULL -- Global
      OR department_id = (SELECT department FROM public.profiles WHERE id = auth.uid())
    )
  )
);

-- Policy INSERT/UPDATE/DELETE: Gerenciar apenas suas próprias
CREATE POLICY "manage_own_canned_responses" ON public.canned_responses
FOR ALL USING (created_by = auth.uid());

-- Admin/Manager podem gerenciar todas
CREATE POLICY "admin_manager_full_access_canned_responses" ON public.canned_responses
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'manager'::app_role)
);