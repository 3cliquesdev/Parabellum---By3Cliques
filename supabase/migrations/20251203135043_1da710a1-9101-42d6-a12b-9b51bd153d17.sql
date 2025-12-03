-- Tabela de vínculo pipeline → vendedores
CREATE TABLE IF NOT EXISTS public.pipeline_sales_reps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pipeline_id, user_id)
);

-- Enable RLS
ALTER TABLE public.pipeline_sales_reps ENABLE ROW LEVEL SECURITY;

-- Admin/Manager podem gerenciar
CREATE POLICY "admin_manager_can_manage_pipeline_reps"
  ON public.pipeline_sales_reps FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'general_manager'::app_role));

-- Authenticated podem visualizar
CREATE POLICY "authenticated_can_view_pipeline_reps"
  ON public.pipeline_sales_reps FOR SELECT
  USING (auth.uid() IS NOT NULL);