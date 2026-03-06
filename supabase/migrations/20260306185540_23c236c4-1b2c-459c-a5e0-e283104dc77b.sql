
-- Cleanup: Remove 6 duplicate/legacy policies + fix 1 interactions policy

-- 1. Duplicatas admin_alerts
DROP POLICY IF EXISTS "managers_delete_admin_alerts" ON admin_alerts;
DROP POLICY IF EXISTS "managers_update_admin_alerts" ON admin_alerts;

-- 2. Duplicatas knowledge_articles
DROP POLICY IF EXISTS "managers_delete_knowledge_articles" ON knowledge_articles;
DROP POLICY IF EXISTS "managers_update_knowledge_articles" ON knowledge_articles;

-- 3. Legadas whatsapp_instances
DROP POLICY IF EXISTS "admin_manager_can_view_all_instances" ON whatsapp_instances;
DROP POLICY IF EXISTS "support_manager_can_view_whatsapp_instances" ON whatsapp_instances;

-- 4. Fix interactions DELETE
DROP POLICY IF EXISTS "mgmt_delete_interactions" ON interactions;
CREATE POLICY "mgmt_delete_interactions" ON interactions FOR DELETE TO authenticated
USING (public.is_manager_or_admin(auth.uid()) OR (created_by = auth.uid() AND created_at > now() - interval '24 hours'));
