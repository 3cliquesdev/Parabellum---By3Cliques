
-- 1. Criar função helper SECURITY DEFINER para obter email do usuário autenticado
CREATE OR REPLACE FUNCTION public.get_auth_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- 2. Recriar policy client_insert_returns
DROP POLICY IF EXISTS "client_insert_returns" ON public.returns;
CREATE POLICY "client_insert_returns"
ON public.returns
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = 'customer'
  AND registered_email = public.get_auth_email()
);

-- 3. Recriar policy client_select_returns
DROP POLICY IF EXISTS "client_select_returns" ON public.returns;
CREATE POLICY "client_select_returns"
ON public.returns
FOR SELECT
TO authenticated
USING (
  registered_email = public.get_auth_email()
);
