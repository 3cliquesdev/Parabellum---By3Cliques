-- Fase 7.2B: Corrigir RLS Policies nas Stages
-- Problema: Policy restritiva bloqueia managers/sales_reps de VISUALIZAR stages

-- Dropar policy restritiva que bloqueia SELECT para não-admins
DROP POLICY IF EXISTS "admins_can_manage_stages" ON stages;

-- Policy 1: Todos autenticados podem VER stages
CREATE POLICY "authenticated_can_view_stages"
ON stages FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Apenas admins podem MODIFICAR stages (INSERT/UPDATE/DELETE)
CREATE POLICY "admins_can_manage_stages"
ON stages FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fase 7.2C: Garantir RLS em Pipelines também permite SELECT
-- Dropar policy restritiva se existir
DROP POLICY IF EXISTS "admins_can_manage_pipelines" ON pipelines;

-- Policy 1: Todos autenticados podem VER pipelines
CREATE POLICY "authenticated_can_view_pipelines"
ON pipelines FOR SELECT
TO authenticated
USING (true);

-- Policy 2: Apenas admins podem MODIFICAR pipelines
CREATE POLICY "admins_can_manage_pipelines"
ON pipelines FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));