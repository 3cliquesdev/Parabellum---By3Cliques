-- Permitir que todos os usuários autenticados possam ver os roles (necessário para listagem de agentes)
-- Esta informação não é sensível e é necessária para funcionalidades de transferência

CREATE POLICY "authenticated_can_view_all_roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (true);

COMMENT ON POLICY "authenticated_can_view_all_roles" ON public.user_roles IS 'Permite que todos os usuários autenticados vejam os roles para funcionalidades de listagem de agentes';