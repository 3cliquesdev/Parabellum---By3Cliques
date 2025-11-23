-- Create enum for application roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS Policy: Users can view their own role
CREATE POLICY "users_can_view_own_role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS Policy: Only admins can manage all roles
CREATE POLICY "admins_can_manage_roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Create trigger to update updated_at
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update existing RLS policies to use role-based access

-- Pipelines: Only admins can manage
DROP POLICY IF EXISTS "Allow authenticated users full access to pipelines" ON public.pipelines;
CREATE POLICY "admins_can_manage_pipelines"
ON public.pipelines
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Stages: Only admins can manage
DROP POLICY IF EXISTS "Allow authenticated users full access to stages" ON public.stages;
CREATE POLICY "admins_can_manage_stages"
ON public.stages
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Forms: Only admins can manage, but keep public view for active forms
DROP POLICY IF EXISTS "Authenticated users can create forms" ON public.forms;
DROP POLICY IF EXISTS "Authenticated users can update forms" ON public.forms;
DROP POLICY IF EXISTS "Authenticated users can delete forms" ON public.forms;

CREATE POLICY "admins_can_insert_forms"
ON public.forms
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_can_update_forms"
ON public.forms
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins_can_delete_forms"
ON public.forms
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Contacts, Conversations, Messages, Deals, Organizations: All authenticated users
-- Keep existing policies as they are already set to "authenticated users"