-- FASE 3: Criar tabela knowledge_articles e RLS policies

-- Criar tabela de artigos da base de conhecimento
CREATE TABLE IF NOT EXISTS public.knowledge_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para busca eficiente
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_title ON public.knowledge_articles(title);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_category ON public.knowledge_articles(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_published ON public.knowledge_articles(is_published);

-- Trigger para atualizar updated_at
CREATE OR REPLACE TRIGGER update_knowledge_articles_updated_at
  BEFORE UPDATE ON public.knowledge_articles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;

-- Policy: Support Agent e Admin/Manager podem visualizar artigos publicados
CREATE POLICY "support_agent_can_view_published_articles"
  ON public.knowledge_articles
  FOR SELECT
  USING (
    is_published = true 
    AND (
      has_role(auth.uid(), 'support_agent') 
      OR has_role(auth.uid(), 'admin') 
      OR has_role(auth.uid(), 'manager')
    )
  );

-- Policy: Admin/Manager podem visualizar todos os artigos (incluindo não publicados)
CREATE POLICY "admin_manager_can_view_all_articles"
  ON public.knowledge_articles
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'manager')
  );

-- Policy: Apenas Admin/Manager podem criar artigos
CREATE POLICY "admin_manager_can_create_articles"
  ON public.knowledge_articles
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'manager')
  );

-- Policy: Apenas Admin/Manager podem atualizar artigos
CREATE POLICY "admin_manager_can_update_articles"
  ON public.knowledge_articles
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'manager')
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'manager')
  );

-- Policy: Apenas Admin/Manager podem deletar artigos
CREATE POLICY "admin_manager_can_delete_articles"
  ON public.knowledge_articles
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin') 
    OR has_role(auth.uid(), 'manager')
  );