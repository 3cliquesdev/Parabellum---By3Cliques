-- Corrigir política RLS de SELECT na tabela user_roles
-- Incluir TODAS as roles de gestão para poderem ver os consultores

DROP POLICY IF EXISTS "admins_managers_can_view_all_roles" ON public.user_roles;

CREATE POLICY "admins_managers_can_view_all_roles" ON public.user_roles
FOR SELECT TO public
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'cs_manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'support_manager'::app_role) OR
  public.has_role(auth.uid(), 'financial_manager'::app_role)
);