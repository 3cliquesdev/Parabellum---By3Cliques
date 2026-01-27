-- =====================================================
-- LIBERAÇÃO DE ACESSO PARA cs_manager E OUTROS GERENTES
-- =====================================================

-- =====================================================
-- 1. ai_message_templates
-- =====================================================
DROP POLICY IF EXISTS "admin_manager_can_delete_ai_message_templates" ON ai_message_templates;
DROP POLICY IF EXISTS "admin_manager_can_insert_ai_message_templates" ON ai_message_templates;
DROP POLICY IF EXISTS "admin_manager_can_update_ai_message_templates" ON ai_message_templates;

CREATE POLICY "managers_can_delete_ai_message_templates"
ON ai_message_templates FOR DELETE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_insert_ai_message_templates"
ON ai_message_templates FOR INSERT TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_update_ai_message_templates"
ON ai_message_templates FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 2. ai_personas
-- =====================================================
DROP POLICY IF EXISTS "admins_managers_can_delete_personas" ON ai_personas;
DROP POLICY IF EXISTS "admins_managers_can_insert_personas" ON ai_personas;
DROP POLICY IF EXISTS "admins_managers_can_update_personas" ON ai_personas;

CREATE POLICY "managers_can_delete_personas"
ON ai_personas FOR DELETE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_insert_personas"
ON ai_personas FOR INSERT TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_update_personas"
ON ai_personas FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 3. ai_tools
-- =====================================================
DROP POLICY IF EXISTS "admins_managers_can_delete_tools" ON ai_tools;
DROP POLICY IF EXISTS "admins_managers_can_insert_tools" ON ai_tools;
DROP POLICY IF EXISTS "admins_managers_can_update_tools" ON ai_tools;

CREATE POLICY "managers_can_delete_tools"
ON ai_tools FOR DELETE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_insert_tools"
ON ai_tools FOR INSERT TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_update_tools"
ON ai_tools FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 4. ai_persona_tools
-- =====================================================
DROP POLICY IF EXISTS "admins_managers_can_delete_persona_tools" ON ai_persona_tools;
DROP POLICY IF EXISTS "admins_managers_can_insert_persona_tools" ON ai_persona_tools;
DROP POLICY IF EXISTS "admins_managers_can_update_persona_tools" ON ai_persona_tools;

CREATE POLICY "managers_can_delete_persona_tools"
ON ai_persona_tools FOR DELETE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_insert_persona_tools"
ON ai_persona_tools FOR INSERT TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_update_persona_tools"
ON ai_persona_tools FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 5. ai_routing_rules
-- =====================================================
DROP POLICY IF EXISTS "admins_managers_can_delete_routing_rules" ON ai_routing_rules;
DROP POLICY IF EXISTS "admins_managers_can_insert_routing_rules" ON ai_routing_rules;
DROP POLICY IF EXISTS "admins_managers_can_update_routing_rules" ON ai_routing_rules;

CREATE POLICY "managers_can_delete_routing_rules"
ON ai_routing_rules FOR DELETE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_insert_routing_rules"
ON ai_routing_rules FOR INSERT TO public
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

CREATE POLICY "managers_can_update_routing_rules"
ON ai_routing_rules FOR UPDATE TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 6. ai_scenario_configs
-- =====================================================
DROP POLICY IF EXISTS "Admin e Manager podem gerenciar cenários" ON ai_scenario_configs;

CREATE POLICY "managers_can_manage_scenarios"
ON ai_scenario_configs FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 7. ai_training_examples
-- =====================================================
DROP POLICY IF EXISTS "Admin e Manager podem gerenciar exemplos de treinamento" ON ai_training_examples;

CREATE POLICY "managers_can_manage_training_examples"
ON ai_training_examples FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 8. cadence_templates
-- =====================================================
DROP POLICY IF EXISTS "Admins can manage cadence templates" ON cadence_templates;

CREATE POLICY "managers_can_manage_cadence_templates"
ON cadence_templates FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 9. automations
-- =====================================================
DROP POLICY IF EXISTS "admins_managers_can_manage_automations" ON automations;

CREATE POLICY "managers_can_manage_automations"
ON automations FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 10. email_block_conditions
-- =====================================================
DROP POLICY IF EXISTS "admin_manager_full_access_conditions" ON email_block_conditions;

CREATE POLICY "managers_full_access_conditions"
ON email_block_conditions FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 11. email_events (apenas SELECT)
-- =====================================================
DROP POLICY IF EXISTS "admin_manager_view_all_events" ON email_events;

CREATE POLICY "managers_view_all_events"
ON email_events FOR SELECT TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- =====================================================
-- 12. email_sends (apenas SELECT)
-- =====================================================
DROP POLICY IF EXISTS "admin_manager_view_all_sends" ON email_sends;

CREATE POLICY "managers_view_all_sends"
ON email_sends FOR SELECT TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role) OR
  has_role(auth.uid(), 'financial_manager'::app_role)
);

-- =====================================================
-- 13. email_variable_definitions
-- =====================================================
DROP POLICY IF EXISTS "admin_manage_variables" ON email_variable_definitions;

CREATE POLICY "managers_manage_variables"
ON email_variable_definitions FOR ALL TO public
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role) OR
  has_role(auth.uid(), 'cs_manager'::app_role) OR
  has_role(auth.uid(), 'general_manager'::app_role) OR
  has_role(auth.uid(), 'support_manager'::app_role)
);