-- Adicionar novos roles ao enum app_role
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'sales_rep';

-- Criar enum de departamentos
CREATE TYPE department_type AS ENUM ('comercial', 'suporte', 'marketing', 'operacional');

-- Adicionar coluna department na tabela profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS department department_type DEFAULT 'comercial';

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_profiles_department ON profiles(department);

-- Comentário explicativo
COMMENT ON COLUMN profiles.department IS 'Departamento do usuário: comercial, suporte, marketing ou operacional';

-- Popular departamento em perfis existentes (default: comercial)
UPDATE profiles 
SET department = 'comercial' 
WHERE department IS NULL;