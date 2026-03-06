-- =====================================================
-- PART 1: FIX NEEDS_FIX policies + redundant policies
-- =====================================================

-- 1. admin_alerts
DROP POLICY IF EXISTS "admin_manager_can_view_alerts" ON public.admin_alerts;
DROP POLICY IF EXISTS "admin_manager_can_update_alerts" ON public.admin_alerts;
DROP POLICY IF EXISTS "admin_manager_can_delete_alerts" ON public.admin_alerts;
CREATE POLICY "mgmt_select_admin_alerts" ON public.admin_alerts FOR SELECT TO authenticated USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "mgmt_update_admin_alerts" ON public.admin_alerts FOR UPDATE TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));
CREATE POLICY "mgmt_delete_admin_alerts" ON public.admin_alerts FOR DELETE TO authenticated USING (is_manager_or_admin(auth.uid()));

-- 2. admin_onboarding_steps
DROP POLICY IF EXISTS "Admin can view all onboarding steps" ON public.admin_onboarding_steps;
CREATE POLICY "mgmt_select_onboarding_steps" ON public.admin_onboarding_steps FOR SELECT TO authenticated USING (is_manager_or_admin(auth.uid()));

-- 3. cadence_enrollments
DROP POLICY IF EXISTS "admin_manager_can_manage_all_enrollments" ON public.cadence_enrollments;
DROP POLICY IF EXISTS "admin_manager_can_view_all_enrollments" ON public.cadence_enrollments;
CREATE POLICY "mgmt_all_cadence_enrollments" ON public.cadence_enrollments FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 4. cadence_steps
DROP POLICY IF EXISTS "admin_manager_can_manage_steps" ON public.cadence_steps;
CREATE POLICY "mgmt_all_cadence_steps" ON public.cadence_steps FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 5. cadence_tasks
DROP POLICY IF EXISTS "admin_manager_can_manage_all_tasks" ON public.cadence_tasks;
DROP POLICY IF EXISTS "admin_manager_can_view_all_tasks" ON public.cadence_tasks;
CREATE POLICY "mgmt_all_cadence_tasks" ON public.cadence_tasks FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 6. cadences
DROP POLICY IF EXISTS "admin_manager_can_manage_cadences" ON public.cadences;
CREATE POLICY "mgmt_all_cadences" ON public.cadences FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 7. canned_responses
DROP POLICY IF EXISTS "admin_manager_full_access_canned_responses" ON public.canned_responses;
DROP POLICY IF EXISTS "support_manager_can_manage_canned_responses" ON public.canned_responses;
CREATE POLICY "mgmt_all_canned_responses" ON public.canned_responses FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 8. conversation_ratings
DROP POLICY IF EXISTS "admin_manager_can_update_ratings" ON public.conversation_ratings;
DROP POLICY IF EXISTS "support_manager_can_view_ratings" ON public.conversation_ratings;
CREATE POLICY "mgmt_all_conversation_ratings" ON public.conversation_ratings FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 9. customer_journey_steps
DROP POLICY IF EXISTS "admin_manager_can_manage_journey_steps" ON public.customer_journey_steps;
DROP POLICY IF EXISTS "cs_manager_can_view_all_journey_steps" ON public.customer_journey_steps;
DROP POLICY IF EXISTS "general_manager_can_update_journey_steps" ON public.customer_journey_steps;
CREATE POLICY "mgmt_all_journey_steps" ON public.customer_journey_steps FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 10. internal_requests
DROP POLICY IF EXISTS "admin_manager_can_manage_internal_requests" ON public.internal_requests;
CREATE POLICY "mgmt_all_internal_requests" ON public.internal_requests FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 11. kiwify_import_queue
DROP POLICY IF EXISTS "admin_manager_can_manage_kiwify_queue" ON public.kiwify_import_queue;
DROP POLICY IF EXISTS "admin_manager_can_view_kiwify_queue" ON public.kiwify_import_queue;
CREATE POLICY "mgmt_all_kiwify_queue" ON public.kiwify_import_queue FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 12. knowledge_articles
DROP POLICY IF EXISTS "admin_manager_can_create_articles" ON public.knowledge_articles;
DROP POLICY IF EXISTS "admin_manager_can_update_articles" ON public.knowledge_articles;
DROP POLICY IF EXISTS "admin_manager_can_delete_articles" ON public.knowledge_articles;
CREATE POLICY "mgmt_insert_articles" ON public.knowledge_articles FOR INSERT TO authenticated WITH CHECK (is_manager_or_admin(auth.uid()));
CREATE POLICY "mgmt_update_articles" ON public.knowledge_articles FOR UPDATE TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));
CREATE POLICY "mgmt_delete_articles" ON public.knowledge_articles FOR DELETE TO authenticated USING (is_manager_or_admin(auth.uid()));

-- 13. playbook_goals
DROP POLICY IF EXISTS "Admin and Manager can manage goals" ON public.playbook_goals;
CREATE POLICY "mgmt_all_playbook_goals" ON public.playbook_goals FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 14. public_ticket_portal_config
DROP POLICY IF EXISTS "admin_manager_can_manage_portal_config" ON public.public_ticket_portal_config;
CREATE POLICY "mgmt_all_portal_config" ON public.public_ticket_portal_config FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 15. support_channels
DROP POLICY IF EXISTS "admin_manager_can_manage_support_channels" ON public.support_channels;
DROP POLICY IF EXISTS "support_manager_can_manage_channels" ON public.support_channels;
CREATE POLICY "mgmt_all_support_channels" ON public.support_channels FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 16. whatsapp_instances
DROP POLICY IF EXISTS "admin_manager_can_manage_all_instances" ON public.whatsapp_instances;
CREATE POLICY "mgmt_all_whatsapp_instances" ON public.whatsapp_instances FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 17. sla_alerts
DROP POLICY IF EXISTS "admin_manager_can_manage_sla_alerts" ON public.sla_alerts;
DROP POLICY IF EXISTS "admin_manager_can_view_all_sla_alerts" ON public.sla_alerts;
DROP POLICY IF EXISTS "support_manager_can_manage_sla_alerts" ON public.sla_alerts;
CREATE POLICY "mgmt_all_sla_alerts" ON public.sla_alerts FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 18. team_members
DROP POLICY IF EXISTS "Admin/Manager can manage team members" ON public.team_members;
DROP POLICY IF EXISTS "support_manager_can_manage_team_members" ON public.team_members;
CREATE POLICY "mgmt_all_team_members" ON public.team_members FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 19. teams
DROP POLICY IF EXISTS "Admin/Manager can manage teams" ON public.teams;
DROP POLICY IF EXISTS "support_manager_can_manage_teams" ON public.teams;
CREATE POLICY "mgmt_all_teams" ON public.teams FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 20. ai_failure_logs
DROP POLICY IF EXISTS "admin_manager_can_view_ai_failure_logs" ON public.ai_failure_logs;
CREATE POLICY "mgmt_select_ai_failure_logs" ON public.ai_failure_logs FOR SELECT TO authenticated USING (is_manager_or_admin(auth.uid()));

-- 21. ai_usage_logs
DROP POLICY IF EXISTS "Admin/Manager can view all AI usage logs" ON public.ai_usage_logs;
CREATE POLICY "mgmt_select_ai_usage_logs" ON public.ai_usage_logs FOR SELECT TO authenticated USING (is_manager_or_admin(auth.uid()));

-- 22. automation_logs
DROP POLICY IF EXISTS "admins_managers_can_view_logs" ON public.automation_logs;
CREATE POLICY "mgmt_select_automation_logs" ON public.automation_logs FOR SELECT TO authenticated USING (is_manager_or_admin(auth.uid()));

-- 23. cs_goals
DROP POLICY IF EXISTS "admin_manager_can_manage_cs_goals" ON public.cs_goals;
CREATE POLICY "mgmt_all_cs_goals" ON public.cs_goals FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 24. group_playbooks
DROP POLICY IF EXISTS "admin_manager_can_manage_group_playbooks" ON public.group_playbooks;
CREATE POLICY "mgmt_all_group_playbooks" ON public.group_playbooks FOR ALL TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 25. playbook_executions
DROP POLICY IF EXISTS "Admin and Manager can view all executions" ON public.playbook_executions;
DROP POLICY IF EXISTS "cs_gm_can_view_all_executions" ON public.playbook_executions;
DROP POLICY IF EXISTS "cs_manager_can_view_all_playbook_executions" ON public.playbook_executions;
DROP POLICY IF EXISTS "cs_manager_can_update_playbook_executions" ON public.playbook_executions;
CREATE POLICY "mgmt_select_playbook_executions" ON public.playbook_executions FOR SELECT TO authenticated USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "mgmt_update_playbook_executions" ON public.playbook_executions FOR UPDATE TO authenticated USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- 26. playbook_execution_queue
DROP POLICY IF EXISTS "Admin and Manager can view all queue items" ON public.playbook_execution_queue;
DROP POLICY IF EXISTS "cs_manager_can_view_execution_queue" ON public.playbook_execution_queue;
CREATE POLICY "mgmt_select_execution_queue" ON public.playbook_execution_queue FOR SELECT TO authenticated USING (is_manager_or_admin(auth.uid()));

-- 27. rlhf_feedback
DROP POLICY IF EXISTS "admins_managers_can_view_all_feedback" ON public.rlhf_feedback;
CREATE POLICY "mgmt_select_rlhf_feedback" ON public.rlhf_feedback FOR SELECT TO authenticated USING (is_manager_or_admin(auth.uid()));

-- 28. scheduled_reports
DROP POLICY IF EXISTS "admin_manager_can_view_all_scheduled_reports" ON public.scheduled_reports;
CREATE POLICY "mgmt_select_scheduled_reports" ON public.scheduled_reports FOR SELECT TO authenticated USING (is_manager_or_admin(auth.uid()));