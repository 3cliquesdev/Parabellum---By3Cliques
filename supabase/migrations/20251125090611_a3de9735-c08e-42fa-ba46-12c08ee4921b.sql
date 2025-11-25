-- =====================================================
-- FIX: Políticas RLS explícitas para AI Studio
-- =====================================================

-- =====================================================
-- TABELA: ai_personas
-- =====================================================

-- Remover políticas existentes
DROP POLICY IF EXISTS "admins_managers_can_manage_personas" ON ai_personas;
DROP POLICY IF EXISTS "sales_rep_can_view_personas" ON ai_personas;

-- Política de SELECT (todos autenticados podem ver)
CREATE POLICY "anyone_can_view_personas" 
ON ai_personas FOR SELECT 
TO authenticated
USING (true);

-- Política de INSERT (apenas admin/manager)
CREATE POLICY "admins_managers_can_insert_personas" 
ON ai_personas FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Política de UPDATE (apenas admin/manager)
CREATE POLICY "admins_managers_can_update_personas" 
ON ai_personas FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Política de DELETE (apenas admin/manager)
CREATE POLICY "admins_managers_can_delete_personas" 
ON ai_personas FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- =====================================================
-- TABELA: ai_tools
-- =====================================================

-- Remover políticas existentes
DROP POLICY IF EXISTS "admins_managers_can_manage_tools" ON ai_tools;
DROP POLICY IF EXISTS "sales_rep_can_view_tools" ON ai_tools;

-- Política de SELECT (todos autenticados podem ver)
CREATE POLICY "anyone_can_view_tools" 
ON ai_tools FOR SELECT 
TO authenticated
USING (true);

-- Política de INSERT (apenas admin/manager)
CREATE POLICY "admins_managers_can_insert_tools" 
ON ai_tools FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Política de UPDATE (apenas admin/manager)
CREATE POLICY "admins_managers_can_update_tools" 
ON ai_tools FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Política de DELETE (apenas admin/manager)
CREATE POLICY "admins_managers_can_delete_tools" 
ON ai_tools FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- =====================================================
-- TABELA: ai_routing_rules
-- =====================================================

-- Remover políticas existentes
DROP POLICY IF EXISTS "admins_managers_can_manage_routing" ON ai_routing_rules;
DROP POLICY IF EXISTS "sales_rep_can_view_routing" ON ai_routing_rules;

-- Política de SELECT (todos autenticados podem ver)
CREATE POLICY "anyone_can_view_routing_rules" 
ON ai_routing_rules FOR SELECT 
TO authenticated
USING (true);

-- Política de INSERT (apenas admin/manager)
CREATE POLICY "admins_managers_can_insert_routing_rules" 
ON ai_routing_rules FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Política de UPDATE (apenas admin/manager)
CREATE POLICY "admins_managers_can_update_routing_rules" 
ON ai_routing_rules FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Política de DELETE (apenas admin/manager)
CREATE POLICY "admins_managers_can_delete_routing_rules" 
ON ai_routing_rules FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- =====================================================
-- TABELA: ai_persona_tools
-- =====================================================

-- Remover políticas existentes
DROP POLICY IF EXISTS "admins_managers_can_manage_persona_tools" ON ai_persona_tools;
DROP POLICY IF EXISTS "sales_rep_can_view_persona_tools" ON ai_persona_tools;

-- Política de SELECT (todos autenticados podem ver)
CREATE POLICY "anyone_can_view_persona_tools" 
ON ai_persona_tools FOR SELECT 
TO authenticated
USING (true);

-- Política de INSERT (apenas admin/manager)
CREATE POLICY "admins_managers_can_insert_persona_tools" 
ON ai_persona_tools FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Política de UPDATE (apenas admin/manager)
CREATE POLICY "admins_managers_can_update_persona_tools" 
ON ai_persona_tools FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Política de DELETE (apenas admin/manager)
CREATE POLICY "admins_managers_can_delete_persona_tools" 
ON ai_persona_tools FOR DELETE 
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);