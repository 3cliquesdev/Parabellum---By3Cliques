-- Criar tabela de categorias de tickets dinâmicas
CREATE TABLE IF NOT EXISTS public.ticket_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir categorias padrão
INSERT INTO public.ticket_categories (name, description, color) VALUES
  ('duvida', 'Dúvidas gerais', '#3B82F6'),
  ('problema_tecnico', 'Problemas técnicos', '#EF4444'),
  ('financeiro', 'Questões financeiras', '#F59E0B'),
  ('sugestao', 'Sugestões e melhorias', '#10B981'),
  ('reclamacao', 'Reclamações', '#8B5CF6'),
  ('saque', 'Solicitações de saque', '#F97316'),
  ('outro', 'Outros assuntos', '#6B7280')
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;

-- Política de leitura para todos autenticados
CREATE POLICY "ticket_categories_select" ON public.ticket_categories
  FOR SELECT TO authenticated USING (true);

-- Política de modificação apenas para admin/manager
CREATE POLICY "ticket_categories_insert" ON public.ticket_categories
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "ticket_categories_update" ON public.ticket_categories
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

CREATE POLICY "ticket_categories_delete" ON public.ticket_categories
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );