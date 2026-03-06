-- PART 2C: forms, interactions, profiles, pipelines, stages, tags, onboarding, instagram, misc

-- forms (consolidate overlapping policies)
DROP POLICY IF EXISTS "Admin/Manager can manage form_automations" ON public.form_automations;
CREATE POLICY "mgmt_all_form_automations" ON public.form_automations FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin/Manager can manage form_calculations" ON public.form_calculations;
DROP POLICY IF EXISTS "Managers can create form calculations" ON public.form_calculations;
DROP POLICY IF EXISTS "Managers can delete form calculations" ON public.form_calculations;
DROP POLICY IF EXISTS "Managers can update form calculations" ON public.form_calculations;
CREATE POLICY "mgmt_all_form_calculations" ON public.form_calculations FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin/Manager can manage form_conditions" ON public.form_conditions;
DROP POLICY IF EXISTS "Managers can create form conditions" ON public.form_conditions;
DROP POLICY IF EXISTS "Managers can delete form conditions" ON public.form_conditions;
DROP POLICY IF EXISTS "Managers can update form conditions" ON public.form_conditions;
CREATE POLICY "mgmt_all_form_conditions" ON public.form_conditions FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Admin/Manager can manage form_submissions" ON public.form_submissions;
CREATE POLICY "mgmt_all_form_submissions" ON public.form_submissions FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

DROP POLICY IF EXISTS "Managers can create forms" ON public.forms;
DROP POLICY IF EXISTS "Managers can delete forms" ON public.forms;
DROP POLICY IF EXISTS "Managers can update forms" ON public.forms;
CREATE POLICY "mgmt_all_forms" ON public.forms FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- interactions (preserve non-manager conditions)
DROP POLICY IF EXISTS "interactions_select_policy" ON public.interactions;
DROP POLICY IF EXISTS "interactions_insert_policy" ON public.interactions;
DROP POLICY IF EXISTS "interactions_update_policy" ON public.interactions;
DROP POLICY IF EXISTS "interactions_delete_policy" ON public.interactions;

CREATE POLICY "mgmt_select_interactions" ON public.interactions FOR SELECT TO authenticated
  USING (
    is_manager_or_admin(auth.uid())
    OR has_role(auth.uid(), 'support_agent'::app_role)
    OR (created_by = auth.uid())
    OR (has_role(auth.uid(), 'sales_rep'::app_role) AND EXISTS (SELECT 1 FROM contacts c WHERE c.id = interactions.customer_id AND c.assigned_to = auth.uid()))
    OR (has_role(auth.uid(), 'consultant'::app_role) AND EXISTS (SELECT 1 FROM contacts c WHERE c.id = interactions.customer_id AND c.consultant_id = auth.uid()))
  );

CREATE POLICY "mgmt_insert_interactions" ON public.interactions FOR INSERT TO authenticated
  WITH CHECK (
    is_manager_or_admin(auth.uid())
    OR has_role(auth.uid(), 'support_agent'::app_role)
    OR (has_role(auth.uid(), 'sales_rep'::app_role) AND (
      EXISTS (SELECT 1 FROM contacts WHERE contacts.id = interactions.customer_id AND contacts.assigned_to = auth.uid())
      OR EXISTS (SELECT 1 FROM conversations WHERE conversations.contact_id = interactions.customer_id AND (conversations.assigned_to = auth.uid() OR conversations.last_message_at > (now() - interval '10 seconds')))
    ))
    OR (has_role(auth.uid(), 'consultant'::app_role) AND (
      EXISTS (SELECT 1 FROM contacts WHERE contacts.id = interactions.customer_id AND contacts.consultant_id = auth.uid())
      OR EXISTS (SELECT 1 FROM conversations WHERE conversations.contact_id = interactions.customer_id AND (conversations.assigned_to = auth.uid() OR conversations.last_message_at > (now() - interval '10 seconds')))
    ))
    OR (has_role(auth.uid(), 'user'::app_role) AND EXISTS (
      SELECT 1 FROM conversations WHERE conversations.contact_id = interactions.customer_id AND (conversations.assigned_to = auth.uid() OR conversations.department = (SELECT p.department FROM profiles p WHERE p.id = auth.uid()))
    ))
  );

CREATE POLICY "mgmt_update_interactions" ON public.interactions FOR UPDATE TO authenticated
  USING (is_manager_or_admin(auth.uid()) OR (created_by = auth.uid()))
  WITH CHECK (is_manager_or_admin(auth.uid()) OR (created_by = auth.uid()));

CREATE POLICY "mgmt_delete_interactions" ON public.interactions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (created_by = auth.uid() AND created_at > (now() - interval '24 hours')));

-- onboarding_playbooks
DROP POLICY IF EXISTS "Admins and managers can manage playbooks" ON public.onboarding_playbooks;
CREATE POLICY "mgmt_all_onboarding_playbooks" ON public.onboarding_playbooks FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- pipeline_sales_reps
DROP POLICY IF EXISTS "admin_manager_can_manage_pipeline_reps" ON public.pipeline_sales_reps;
CREATE POLICY "mgmt_all_pipeline_reps" ON public.pipeline_sales_reps FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- pipelines
DROP POLICY IF EXISTS "managers_can_manage_pipelines" ON public.pipelines;
CREATE POLICY "mgmt_all_pipelines" ON public.pipelines FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- playbook_products
DROP POLICY IF EXISTS "Managers can manage playbook_products" ON public.playbook_products;
CREATE POLICY "mgmt_all_playbook_products" ON public.playbook_products FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- profiles (keep specific conditions, consolidate manager view/update)
DROP POLICY IF EXISTS "management_roles_can_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "management_roles_can_view_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "support_manager_can_update_profiles" ON public.profiles;
DROP POLICY IF EXISTS "support_manager_can_view_all_profiles" ON public.profiles;
CREATE POLICY "mgmt_select_all_profiles" ON public.profiles FOR SELECT TO authenticated
  USING (is_manager_or_admin(auth.uid()));
CREATE POLICY "mgmt_update_all_profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- stages
DROP POLICY IF EXISTS "managers_can_manage_stages" ON public.stages;
CREATE POLICY "mgmt_all_stages" ON public.stages FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- tags
DROP POLICY IF EXISTS "support_manager_can_manage_tags" ON public.tags;
DROP POLICY IF EXISTS "tags_delete_policy" ON public.tags;
DROP POLICY IF EXISTS "tags_insert_policy" ON public.tags;
DROP POLICY IF EXISTS "tags_update_policy" ON public.tags;
CREATE POLICY "mgmt_insert_tags" ON public.tags FOR INSERT TO authenticated
  WITH CHECK (is_manager_or_admin(auth.uid()));
CREATE POLICY "mgmt_update_tags" ON public.tags FOR UPDATE TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));
CREATE POLICY "mgmt_delete_tags" ON public.tags FOR DELETE TO authenticated
  USING (is_manager_or_admin(auth.uid()));

-- instagram tables
DROP POLICY IF EXISTS "admins_managers_can_manage_instagram_accounts" ON public.instagram_accounts;
CREATE POLICY "mgmt_all_instagram_accounts" ON public.instagram_accounts FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

DROP POLICY IF EXISTS "admins_managers_can_manage_instagram_posts" ON public.instagram_posts;
CREATE POLICY "mgmt_all_instagram_posts" ON public.instagram_posts FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

DROP POLICY IF EXISTS "admins_can_manage_sync_logs" ON public.instagram_sync_log;
CREATE POLICY "mgmt_all_instagram_sync_log" ON public.instagram_sync_log FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- instagram_comments (mixed conditions)
DROP POLICY IF EXISTS "admins_can_delete_instagram_comments" ON public.instagram_comments;
DROP POLICY IF EXISTS "admins_can_insert_instagram_comments" ON public.instagram_comments;
DROP POLICY IF EXISTS "users_can_update_assigned_comments" ON public.instagram_comments;
DROP POLICY IF EXISTS "users_can_view_instagram_comments" ON public.instagram_comments;
CREATE POLICY "mgmt_all_instagram_comments" ON public.instagram_comments FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));
CREATE POLICY "agent_select_instagram_comments" ON public.instagram_comments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND assigned_to = auth.uid());
CREATE POLICY "agent_update_instagram_comments" ON public.instagram_comments FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND assigned_to = auth.uid());

-- instagram_messages (mixed conditions)
DROP POLICY IF EXISTS "admins_can_delete_instagram_messages" ON public.instagram_messages;
DROP POLICY IF EXISTS "admins_can_insert_instagram_messages" ON public.instagram_messages;
DROP POLICY IF EXISTS "users_can_update_assigned_messages" ON public.instagram_messages;
DROP POLICY IF EXISTS "users_can_view_instagram_messages" ON public.instagram_messages;
CREATE POLICY "mgmt_all_instagram_messages" ON public.instagram_messages FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));
CREATE POLICY "agent_select_instagram_messages" ON public.instagram_messages FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND assigned_to = auth.uid());
CREATE POLICY "agent_update_instagram_messages" ON public.instagram_messages FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND assigned_to = auth.uid());

-- instagram_comment_replies
DROP POLICY IF EXISTS "users_can_view_instagram_replies" ON public.instagram_comment_replies;
CREATE POLICY "mgmt_or_sender_select_replies" ON public.instagram_comment_replies FOR SELECT TO authenticated
  USING (is_manager_or_admin(auth.uid()) OR sent_by = auth.uid());

-- media_attachments
DROP POLICY IF EXISTS "Admins can delete media" ON public.media_attachments;
DROP POLICY IF EXISTS "Users can update their own uploads" ON public.media_attachments;
DROP POLICY IF EXISTS "Users can upload media to their conversations" ON public.media_attachments;
DROP POLICY IF EXISTS "Users can view media in their conversations" ON public.media_attachments;
CREATE POLICY "mgmt_all_media" ON public.media_attachments FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));
CREATE POLICY "user_select_own_media" ON public.media_attachments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM conversations c WHERE c.id = media_attachments.conversation_id AND c.assigned_to = auth.uid()));
CREATE POLICY "user_insert_own_media" ON public.media_attachments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = media_attachments.conversation_id AND c.assigned_to = auth.uid()));
CREATE POLICY "user_update_own_media" ON public.media_attachments FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid());

-- kiwify_events
DROP POLICY IF EXISTS "authorized_roles_can_view_kiwify_events" ON public.kiwify_events;
CREATE POLICY "mgmt_select_kiwify_events" ON public.kiwify_events FOR SELECT TO authenticated
  USING (is_manager_or_admin(auth.uid()) OR has_role(auth.uid(), 'financial_agent'::app_role));

-- departments (support_manager view)
DROP POLICY IF EXISTS "support_manager_can_view_departments" ON public.departments;
CREATE POLICY "mgmt_select_departments" ON public.departments FOR SELECT TO authenticated
  USING (is_manager_or_admin(auth.uid()));

-- quotes
DROP POLICY IF EXISTS "role_based_select_quotes" ON public.quotes;
DROP POLICY IF EXISTS "financial_manager_can_manage_quotes" ON public.quotes;
DROP POLICY IF EXISTS "financial_manager_can_view_quotes" ON public.quotes;
CREATE POLICY "mgmt_select_quotes" ON public.quotes FOR SELECT TO authenticated
  USING (
    is_manager_or_admin(auth.uid())
    OR (has_role(auth.uid(), 'sales_rep'::app_role) AND (created_by = auth.uid() OR EXISTS (SELECT 1 FROM deals d WHERE d.id = quotes.deal_id AND d.assigned_to = auth.uid())))
  );
CREATE POLICY "mgmt_all_quotes" ON public.quotes FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- quote_items
DROP POLICY IF EXISTS "role_based_select_quote_items" ON public.quote_items;
CREATE POLICY "mgmt_select_quote_items" ON public.quote_items FOR SELECT TO authenticated
  USING (
    is_manager_or_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM quotes q WHERE q.id = quote_items.quote_id AND has_role(auth.uid(), 'sales_rep'::app_role) AND q.created_by = auth.uid())
  );

-- project_board_templates
DROP POLICY IF EXISTS "Templates gerenciáveis por admin/manager" ON public.project_board_templates;
CREATE POLICY "mgmt_all_board_templates" ON public.project_board_templates FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- project_boards
DROP POLICY IF EXISTS "Boards deletáveis por admin/manager" ON public.project_boards;
CREATE POLICY "mgmt_delete_boards" ON public.project_boards FOR DELETE TO authenticated
  USING (is_manager_or_admin(auth.uid()));

-- sync_jobs
DROP POLICY IF EXISTS "admin_manager_view_all_sync_jobs" ON public.sync_jobs;
CREATE POLICY "mgmt_select_sync_jobs" ON public.sync_jobs FOR SELECT TO authenticated
  USING (is_manager_or_admin(auth.uid()));

-- ticket_comments (mixed)
DROP POLICY IF EXISTS "role_based_delete_comments" ON public.ticket_comments;
CREATE POLICY "mgmt_delete_ticket_comments" ON public.ticket_comments FOR DELETE TO authenticated
  USING (is_manager_or_admin(auth.uid()));

DROP POLICY IF EXISTS "team_can_comment_on_tickets" ON public.ticket_comments;
CREATE POLICY "mgmt_insert_ticket_comments" ON public.ticket_comments FOR INSERT TO authenticated
  WITH CHECK (
    is_manager_or_admin(auth.uid())
    OR has_role(auth.uid(), 'support_agent'::app_role)
    OR has_role(auth.uid(), 'financial_agent'::app_role)
    OR has_role(auth.uid(), 'consultant'::app_role)
    OR EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_comments.ticket_id AND t.created_by = auth.uid())
  );