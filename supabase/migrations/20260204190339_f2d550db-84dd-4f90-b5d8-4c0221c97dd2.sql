-- =====================================================
-- FIX: Corrigir visibilidade Admin no inbox_view
-- Problema: RLS recursion block na subquery EXISTS para user_roles
-- Solução: Usar função SECURITY DEFINER para bypass RLS
-- =====================================================

-- Fase 1: Criar função has_any_role (SECURITY DEFINER)
-- Esta função verifica se o usuário tem QUALQUER um dos roles especificados
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = ANY(_roles)
  )
$$;

-- Fase 2: Reescrever policy de inbox_view usando a função SECURITY DEFINER
DROP POLICY IF EXISTS optimized_inbox_select ON public.inbox_view;

CREATE POLICY optimized_inbox_select
ON public.inbox_view
FOR SELECT
TO authenticated
USING (
  -- Managers/Admins: acesso total (via SECURITY DEFINER - bypassa RLS)
  public.has_any_role(
    auth.uid(), 
    ARRAY['admin','manager','general_manager','support_manager','cs_manager','financial_manager']::app_role[]
  )
  OR
  -- Assigned to me: sempre pode ver suas próprias conversas
  (assigned_to = auth.uid())
  OR
  -- Agentes: mesmo departamento ou pool global (não atribuídas)
  (
    public.has_any_role(
      auth.uid(),
      ARRAY['sales_rep','support_agent','financial_agent','consultant']::app_role[]
    )
    AND (
      department = (SELECT department FROM public.profiles WHERE id = auth.uid())
      OR (assigned_to IS NULL AND department IS NULL)
    )
  )
);