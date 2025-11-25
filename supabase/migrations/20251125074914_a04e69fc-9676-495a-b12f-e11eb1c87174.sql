-- Permitir que usuários anônimos vejam departamentos ativos
CREATE POLICY "anon_can_view_active_departments"
ON public.departments
FOR SELECT
TO anon
USING (is_active = true);