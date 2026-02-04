-- =============================================================
-- OTIMIZAÇÃO DE PERFORMANCE: RLS DEALS + ÍNDICE USER_ROLES
-- Resolve timeouts para sales_rep com 18k+ deals
-- =============================================================

-- Fase 1: Índice composto para acelerar verificação de roles
CREATE INDEX IF NOT EXISTS idx_user_roles_uid_role 
ON public.user_roles(user_id, role);

-- Fase 2: Substituir política RLS que usa has_role() por EXISTS otimizado
-- DROP das políticas atuais
DROP POLICY IF EXISTS "role_based_select_deals" ON public.deals;

-- Nova política otimizada para SELECT
-- Usa EXISTS com subquery única em vez de has_role() por row
CREATE POLICY "optimized_select_deals" ON public.deals
FOR SELECT TO authenticated
USING (
  -- Admins/Managers: acesso total (EXISTS avaliado UMA vez, não por row)
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager', 'general_manager', 'support_manager', 'cs_manager', 'financial_manager')
  )
  OR
  -- Sales_rep/User: apenas deals atribuídos a si
  -- Colocar assigned_to primeiro permite uso do índice idx_deals_assigned_status
  (
    assigned_to = auth.uid() 
    AND EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('sales_rep', 'user', 'consultant')
    )
  )
);