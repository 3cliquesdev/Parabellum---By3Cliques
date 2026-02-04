-- =====================================================
-- CORREÇÃO: Remover policies legadas de inbox_view
-- =====================================================

DROP POLICY IF EXISTS cs_manager_view_inbox ON public.inbox_view;
DROP POLICY IF EXISTS financial_agent_view_inbox ON public.inbox_view;
DROP POLICY IF EXISTS financial_manager_view_inbox ON public.inbox_view;
DROP POLICY IF EXISTS general_manager_view_inbox ON public.inbox_view;
DROP POLICY IF EXISTS sales_rep_view_sales_inbox ON public.inbox_view;
DROP POLICY IF EXISTS support_agent_view_assigned_inbox ON public.inbox_view;
DROP POLICY IF EXISTS support_manager_view_inbox ON public.inbox_view;
DROP POLICY IF EXISTS user_view_department_inbox ON public.inbox_view;

-- Recriar policy unificada
DROP POLICY IF EXISTS optimized_inbox_select ON public.inbox_view;

CREATE POLICY optimized_inbox_select
ON public.inbox_view
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('admin','manager','general_manager','support_manager','cs_manager','financial_manager')
  )
  OR (assigned_to = auth.uid())
  OR (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('sales_rep','support_agent','financial_agent','consultant'))
    AND (department = (SELECT department FROM public.profiles WHERE id = auth.uid()) OR (assigned_to IS NULL AND department IS NULL))
  )
);