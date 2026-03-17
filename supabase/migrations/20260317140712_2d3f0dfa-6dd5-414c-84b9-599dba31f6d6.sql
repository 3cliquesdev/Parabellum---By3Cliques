
-- Adicionar coluna department_id à tabela pipelines
ALTER TABLE public.pipelines 
ADD COLUMN department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL;

-- Índice para performance nas consultas filtradas
CREATE INDEX idx_pipelines_department_id ON public.pipelines(department_id);
