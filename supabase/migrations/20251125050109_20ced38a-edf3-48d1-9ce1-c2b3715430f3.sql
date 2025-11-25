-- FASE: Sistema Dinâmico de Departamentos
-- Criar tabela departments e migrar profiles.department de ENUM para FK

-- 1. Criar tabela departments
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#3B82F6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 2. Inserir departamentos iniciais (migração dos ENUMs existentes)
INSERT INTO public.departments (name, description, color) VALUES
  ('Comercial', 'Equipe de vendas e prospecção', '#22C55E'),
  ('Suporte', 'Atendimento e resolução de tickets', '#3B82F6'),
  ('Marketing', 'Geração de leads e campanhas', '#A855F7'),
  ('Operacional', 'Processos internos e infraestrutura', '#F59E0B'),
  ('Customer Success', 'Consultoria e gestão de carteira pós-venda', '#EC4899')
ON CONFLICT (name) DO NOTHING;

-- 3. Adicionar coluna temporária department_id em profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id);

-- 4. Migrar dados existentes de department (ENUM) para department_id (FK)
UPDATE public.profiles p
SET department_id = d.id
FROM public.departments d
WHERE LOWER(p.department::text) = LOWER(d.name);

-- 5. Remover coluna antiga department (ENUM)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS department;

-- 6. Renomear department_id para department
ALTER TABLE public.profiles RENAME COLUMN department_id TO department;

-- 7. Tornar department obrigatório
ALTER TABLE public.profiles ALTER COLUMN department SET NOT NULL;

-- 8. Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department);

-- 9. Trigger para updated_at em departments
CREATE OR REPLACE FUNCTION update_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW
EXECUTE FUNCTION update_departments_updated_at();

-- 10. RLS Policies para departments
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Todos usuários autenticados podem ver departamentos
CREATE POLICY "authenticated_can_view_departments"
ON public.departments
FOR SELECT
TO authenticated
USING (true);

-- Apenas admins podem gerenciar departamentos
CREATE POLICY "admins_can_manage_departments"
ON public.departments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 11. Comentários para documentação
COMMENT ON TABLE public.departments IS 'Departamentos organizacionais para alocação de usuários';
COMMENT ON COLUMN public.departments.name IS 'Nome único do departamento';
COMMENT ON COLUMN public.departments.color IS 'Cor em hexadecimal para identificação visual';
COMMENT ON COLUMN public.departments.is_active IS 'Departamentos inativos não aparecem em seleções';