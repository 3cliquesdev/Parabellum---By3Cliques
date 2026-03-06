-- PART 2B: contacts + email tables

-- contacts
DROP POLICY IF EXISTS "role_based_select_contacts" ON public.contacts;
DROP POLICY IF EXISTS "role_based_insert_contacts" ON public.contacts;
DROP POLICY IF EXISTS "role_based_update_contacts" ON public.contacts;
DROP POLICY IF EXISTS "role_based_delete_contacts" ON public.contacts;
DROP POLICY IF EXISTS "cs_manager_can_update_customers" ON public.contacts;

CREATE POLICY "mgmt_select_contacts" ON public.contacts FOR SELECT TO authenticated
  USING (
    is_manager_or_admin(auth.uid())
    OR has_role(auth.uid(), 'financial_agent'::app_role)
    OR has_role(auth.uid(), 'support_agent'::app_role)
    OR has_role(auth.uid(), 'ecommerce_analyst'::app_role)
    OR has_role(auth.uid(), 'consultant'::app_role)
    OR (has_role(auth.uid(), 'sales_rep'::app_role) AND (
      assigned_to = auth.uid()
      OR id IN (SELECT deals.contact_id FROM deals WHERE deals.assigned_to = auth.uid() AND deals.contact_id IS NOT NULL)
      OR id IN (SELECT conversations.contact_id FROM conversations WHERE conversations.assigned_to = auth.uid())
    ))
    OR (has_role(auth.uid(), 'user'::app_role) AND id IN (
      SELECT conversations.contact_id FROM conversations
      WHERE conversations.assigned_to = auth.uid()
        OR conversations.department = (SELECT p.department FROM profiles p WHERE p.id = auth.uid())
    ))
  );

CREATE POLICY "mgmt_insert_contacts" ON public.contacts FOR INSERT TO authenticated
  WITH CHECK (
    is_manager_or_admin(auth.uid())
    OR (has_role(auth.uid(), 'sales_rep'::app_role) AND (assigned_to = auth.uid() OR assigned_to IS NULL))
  );

CREATE POLICY "mgmt_update_contacts" ON public.contacts FOR UPDATE TO authenticated
  USING (
    is_manager_or_admin(auth.uid())
    OR (has_role(auth.uid(), 'sales_rep'::app_role) AND assigned_to = auth.uid())
  )
  WITH CHECK (
    is_manager_or_admin(auth.uid())
    OR (has_role(auth.uid(), 'sales_rep'::app_role) AND (assigned_to = auth.uid() OR assigned_to IS NULL))
  );

CREATE POLICY "mgmt_delete_contacts" ON public.contacts FOR DELETE TO authenticated
  USING (is_manager_or_admin(auth.uid()));

-- email_block_conditions
DROP POLICY IF EXISTS "managers_full_access_conditions" ON public.email_block_conditions;
CREATE POLICY "mgmt_all_email_block_conditions" ON public.email_block_conditions FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- email_branding
DROP POLICY IF EXISTS "authorized_roles_can_manage_email_branding" ON public.email_branding;
CREATE POLICY "mgmt_all_email_branding" ON public.email_branding FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- email_events
DROP POLICY IF EXISTS "managers_view_all_events" ON public.email_events;
CREATE POLICY "mgmt_select_email_events" ON public.email_events FOR SELECT TO authenticated
  USING (is_manager_or_admin(auth.uid()));

-- email_layout_library
DROP POLICY IF EXISTS "authorized_roles_manage_layouts" ON public.email_layout_library;
CREATE POLICY "mgmt_all_email_layouts" ON public.email_layout_library FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- email_senders
DROP POLICY IF EXISTS "authorized_roles_can_manage_email_senders" ON public.email_senders;
CREATE POLICY "mgmt_all_email_senders" ON public.email_senders FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- email_sends
DROP POLICY IF EXISTS "managers_view_all_sends" ON public.email_sends;
CREATE POLICY "mgmt_select_email_sends" ON public.email_sends FOR SELECT TO authenticated
  USING (is_manager_or_admin(auth.uid()));

-- email_template_blocks
DROP POLICY IF EXISTS "admin_manager_cs_full_access_blocks" ON public.email_template_blocks;
CREATE POLICY "mgmt_all_email_template_blocks" ON public.email_template_blocks FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- email_template_translations
DROP POLICY IF EXISTS "admin_manager_cs_full_access_translations" ON public.email_template_translations;
CREATE POLICY "mgmt_all_email_template_translations" ON public.email_template_translations FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- email_template_variants
DROP POLICY IF EXISTS "admin_manager_cs_full_access_variants" ON public.email_template_variants;
CREATE POLICY "mgmt_all_email_template_variants" ON public.email_template_variants FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- email_templates
DROP POLICY IF EXISTS "admins_managers_cs_can_manage_email_templates" ON public.email_templates;
CREATE POLICY "mgmt_all_email_templates" ON public.email_templates FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- email_templates_v2
DROP POLICY IF EXISTS "authorized_roles_full_access_templates_v2" ON public.email_templates_v2;
CREATE POLICY "mgmt_all_email_templates_v2" ON public.email_templates_v2 FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));

-- email_tracking_events
DROP POLICY IF EXISTS "admin_manager_view_email_tracking" ON public.email_tracking_events;
CREATE POLICY "mgmt_select_email_tracking" ON public.email_tracking_events FOR SELECT TO authenticated
  USING (is_manager_or_admin(auth.uid()));

-- email_variable_definitions
DROP POLICY IF EXISTS "managers_manage_variables" ON public.email_variable_definitions;
CREATE POLICY "mgmt_all_email_variables" ON public.email_variable_definitions FOR ALL TO authenticated
  USING (is_manager_or_admin(auth.uid())) WITH CHECK (is_manager_or_admin(auth.uid()));