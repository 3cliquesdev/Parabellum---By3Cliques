
-- Liberar gerentes nas 5 tabelas (substituir admin-only por is_manager_or_admin)

-- 1. PRODUCTS
DROP POLICY IF EXISTS "admins_can_manage_products" ON public.products;
CREATE POLICY "managers_can_manage_products" ON public.products
  FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid()))
  WITH CHECK (is_manager_or_admin(auth.uid()));

-- 2. DEPARTMENTS
DROP POLICY IF EXISTS "admins_can_manage_departments" ON public.departments;
CREATE POLICY "managers_can_manage_departments" ON public.departments
  FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid()))
  WITH CHECK (is_manager_or_admin(auth.uid()));

-- 3. SALES_GOALS
DROP POLICY IF EXISTS "admins_can_manage_goals" ON public.sales_goals;
CREATE POLICY "managers_can_manage_goals" ON public.sales_goals
  FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid()))
  WITH CHECK (is_manager_or_admin(auth.uid()));

-- 4. GOAL_MILESTONES
DROP POLICY IF EXISTS "admins_can_manage_milestones" ON public.goal_milestones;
CREATE POLICY "managers_can_manage_milestones" ON public.goal_milestones
  FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid()))
  WITH CHECK (is_manager_or_admin(auth.uid()));

-- 5. AI_RESPONSE_CACHE: remover policies antigas (já existem as novas com is_manager_or_admin)
DROP POLICY IF EXISTS "admins_can_delete_cache" ON public.ai_response_cache;
DROP POLICY IF EXISTS "admins_managers_can_insert_cache" ON public.ai_response_cache;
