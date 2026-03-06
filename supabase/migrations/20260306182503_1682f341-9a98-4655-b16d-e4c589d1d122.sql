-- PART 2A: AI tables + activities + agent_channels + automations + cadence_templates

-- activities
DROP POLICY IF EXISTS "role_based_select_activities" ON public.activities;
DROP POLICY IF EXISTS "support_manager_can_manage_activities" ON public.activities;
CREATE POLICY "mgmt_select_activities" ON public.activities FOR SELECT TO authenticated
  USING (is_manager_or_admin(auth.uid()) OR (has_role(auth.uid(), 'sales_rep'::app_role) AND (assigned_to = auth.uid())));
CREATE POLICY "mgmt_all_activities" ON public.activities FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- agent_support_channels
DROP POLICY IF EXISTS "admin_manager_can_manage_agent_channels" ON public.agent_support_channels;
DROP POLICY IF EXISTS "admin_manager_can_view_all_agent_channels" ON public.agent_support_channels;
CREATE POLICY "mgmt_all_agent_channels" ON public.agent_support_channels FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- ai_message_templates
DROP POLICY IF EXISTS "managers_can_delete_ai_message_templates" ON public.ai_message_templates;
DROP POLICY IF EXISTS "managers_can_insert_ai_message_templates" ON public.ai_message_templates;
DROP POLICY IF EXISTS "managers_can_update_ai_message_templates" ON public.ai_message_templates;
CREATE POLICY "mgmt_all_ai_message_templates" ON public.ai_message_templates FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- ai_persona_tools
DROP POLICY IF EXISTS "managers_can_delete_persona_tools" ON public.ai_persona_tools;
DROP POLICY IF EXISTS "managers_can_insert_persona_tools" ON public.ai_persona_tools;
DROP POLICY IF EXISTS "managers_can_update_persona_tools" ON public.ai_persona_tools;
CREATE POLICY "mgmt_all_ai_persona_tools" ON public.ai_persona_tools FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- ai_personas
DROP POLICY IF EXISTS "managers_can_delete_personas" ON public.ai_personas;
DROP POLICY IF EXISTS "managers_can_insert_personas" ON public.ai_personas;
DROP POLICY IF EXISTS "managers_can_update_personas" ON public.ai_personas;
CREATE POLICY "mgmt_all_ai_personas" ON public.ai_personas FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- ai_quality_logs
DROP POLICY IF EXISTS "support_manager_can_view_ai_logs" ON public.ai_quality_logs;
CREATE POLICY "mgmt_all_ai_quality_logs" ON public.ai_quality_logs FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- ai_routing_rules
DROP POLICY IF EXISTS "managers_can_delete_routing_rules" ON public.ai_routing_rules;
DROP POLICY IF EXISTS "managers_can_insert_routing_rules" ON public.ai_routing_rules;
DROP POLICY IF EXISTS "managers_can_update_routing_rules" ON public.ai_routing_rules;
CREATE POLICY "mgmt_all_ai_routing_rules" ON public.ai_routing_rules FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- ai_scenario_configs
DROP POLICY IF EXISTS "managers_can_manage_scenarios" ON public.ai_scenario_configs;
CREATE POLICY "mgmt_all_ai_scenario_configs" ON public.ai_scenario_configs FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- ai_tools
DROP POLICY IF EXISTS "managers_can_delete_tools" ON public.ai_tools;
DROP POLICY IF EXISTS "managers_can_insert_tools" ON public.ai_tools;
DROP POLICY IF EXISTS "managers_can_update_tools" ON public.ai_tools;
CREATE POLICY "mgmt_all_ai_tools" ON public.ai_tools FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- ai_training_examples
DROP POLICY IF EXISTS "managers_can_manage_training_examples" ON public.ai_training_examples;
CREATE POLICY "mgmt_all_ai_training_examples" ON public.ai_training_examples FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- automations
DROP POLICY IF EXISTS "managers_can_manage_automations" ON public.automations;
CREATE POLICY "mgmt_all_automations" ON public.automations FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- cadence_templates
DROP POLICY IF EXISTS "managers_can_manage_cadence_templates" ON public.cadence_templates;
CREATE POLICY "mgmt_all_cadence_templates" ON public.cadence_templates FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- delivery_groups
DROP POLICY IF EXISTS "admin_manager_can_manage_delivery_groups" ON public.delivery_groups;
CREATE POLICY "mgmt_all_delivery_groups" ON public.delivery_groups FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));