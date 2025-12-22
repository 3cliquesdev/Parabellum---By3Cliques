-- =====================================================
-- CORREÇÃO: Adicionar support_manager às políticas RLS
-- =====================================================

-- 1. TABELA FORMS - Atualizar políticas
-- -------------------------------------

-- DROP das políticas antigas
DROP POLICY IF EXISTS "admins_managers_can_insert_forms" ON forms;
DROP POLICY IF EXISTS "admins_managers_can_update_forms" ON forms;
DROP POLICY IF EXISTS "admins_managers_can_delete_forms" ON forms;

-- Nova política de INSERT incluindo support_manager
CREATE POLICY "admins_managers_can_insert_forms" ON forms
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = ANY (ARRAY[
      'admin'::app_role, 
      'manager'::app_role, 
      'general_manager'::app_role,
      'support_manager'::app_role
    ])
  )
);

-- Nova política de UPDATE incluindo support_manager
CREATE POLICY "admins_managers_can_update_forms" ON forms
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = ANY (ARRAY[
      'admin'::app_role, 
      'manager'::app_role, 
      'general_manager'::app_role,
      'support_manager'::app_role
    ])
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = ANY (ARRAY[
      'admin'::app_role, 
      'manager'::app_role, 
      'general_manager'::app_role,
      'support_manager'::app_role
    ])
  )
);

-- Nova política de DELETE incluindo support_manager
CREATE POLICY "admins_managers_can_delete_forms" ON forms
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = ANY (ARRAY[
      'admin'::app_role, 
      'manager'::app_role, 
      'general_manager'::app_role,
      'support_manager'::app_role
    ])
  )
);

-- 2. TABELA FORM_CONDITIONS - Atualizar políticas
-- ------------------------------------------------

DROP POLICY IF EXISTS "admins_managers_can_insert_form_conditions" ON form_conditions;
DROP POLICY IF EXISTS "admins_managers_can_update_form_conditions" ON form_conditions;
DROP POLICY IF EXISTS "admins_managers_can_delete_form_conditions" ON form_conditions;

CREATE POLICY "admins_managers_can_insert_form_conditions" ON form_conditions
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = ANY (ARRAY[
      'admin'::app_role, 
      'manager'::app_role, 
      'general_manager'::app_role,
      'support_manager'::app_role
    ])
  )
);

CREATE POLICY "admins_managers_can_update_form_conditions" ON form_conditions
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = ANY (ARRAY[
      'admin'::app_role, 
      'manager'::app_role, 
      'general_manager'::app_role,
      'support_manager'::app_role
    ])
  )
);

CREATE POLICY "admins_managers_can_delete_form_conditions" ON form_conditions
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = ANY (ARRAY[
      'admin'::app_role, 
      'manager'::app_role, 
      'general_manager'::app_role,
      'support_manager'::app_role
    ])
  )
);

-- 3. TABELA FORM_CALCULATIONS - Atualizar políticas
-- --------------------------------------------------

DROP POLICY IF EXISTS "admins_managers_can_insert_form_calculations" ON form_calculations;
DROP POLICY IF EXISTS "admins_managers_can_update_form_calculations" ON form_calculations;
DROP POLICY IF EXISTS "admins_managers_can_delete_form_calculations" ON form_calculations;

CREATE POLICY "admins_managers_can_insert_form_calculations" ON form_calculations
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = ANY (ARRAY[
      'admin'::app_role, 
      'manager'::app_role, 
      'general_manager'::app_role,
      'support_manager'::app_role
    ])
  )
);

CREATE POLICY "admins_managers_can_update_form_calculations" ON form_calculations
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = ANY (ARRAY[
      'admin'::app_role, 
      'manager'::app_role, 
      'general_manager'::app_role,
      'support_manager'::app_role
    ])
  )
);

CREATE POLICY "admins_managers_can_delete_form_calculations" ON form_calculations
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = ANY (ARRAY[
      'admin'::app_role, 
      'manager'::app_role, 
      'general_manager'::app_role,
      'support_manager'::app_role
    ])
  )
);