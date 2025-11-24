-- Criar tabela profiles para informações públicas dos usuários
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  job_title TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Todos autenticados podem ver perfis
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Usuários podem atualizar apenas seu próprio perfil
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Admins podem inserir perfis (para criação manual de usuários)
CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função que cria perfil automaticamente quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, job_title)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário Sem Nome'),
    COALESCE(NEW.raw_user_meta_data->>'job_title', 'Vendedor')
  );
  RETURN NEW;
END;
$$;

-- Trigger que dispara após criação de usuário em auth.users
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_profile();

-- Adicionar coluna assigned_to em deals
ALTER TABLE public.deals
ADD COLUMN assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Adicionar coluna assigned_to em contacts
ALTER TABLE public.contacts
ADD COLUMN assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Atualizar FK de created_by em interactions para profiles
ALTER TABLE public.interactions
DROP CONSTRAINT IF EXISTS interactions_created_by_fkey,
ADD CONSTRAINT interactions_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Atualizar FK de created_by em customer_tags para profiles
ALTER TABLE public.customer_tags
DROP CONSTRAINT IF EXISTS customer_tags_created_by_fkey,
ADD CONSTRAINT customer_tags_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Migração de dados: Criar perfis para usuários existentes
INSERT INTO public.profiles (id, full_name, job_title)
SELECT 
  ur.user_id,
  'Usuário ' || substring(au.email from 1 for position('@' in au.email) - 1),
  CASE 
    WHEN ur.role = 'admin' THEN 'Administrador'
    ELSE 'Vendedor'
  END
FROM public.user_roles ur
JOIN auth.users au ON au.id = ur.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.id = ur.user_id
);