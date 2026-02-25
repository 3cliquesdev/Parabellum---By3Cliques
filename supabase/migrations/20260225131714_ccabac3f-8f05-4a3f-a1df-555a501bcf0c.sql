
-- ================================================================
-- AUDITORIA RLS: Alinhamento conversations ↔ tabelas dependentes
-- ================================================================

-- ---------------------------------------------------------------
-- 1) ai_suggestions SELECT
--    GAP: Só admin/manager/sales_rep veem. Faltam: outros agent roles,
--    outros manager roles, e visibilidade de conversas não atribuídas.
--    FIX: Alinhar com canonical_select_conversations.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "role_based_select_ai_suggestions" ON ai_suggestions;

CREATE POLICY "role_based_select_ai_suggestions" ON ai_suggestions FOR SELECT
TO authenticated
USING (
  -- Gerentes veem tudo (contrato de paridade)
  is_manager_or_admin(auth.uid())
  OR
  -- Agente vê sugestões de conversas atribuídas a ele
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = ai_suggestions.conversation_id
      AND c.assigned_to = auth.uid()
  )
  OR
  -- Agente vê sugestões de conversas não atribuídas do mesmo departamento
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = ai_suggestions.conversation_id
      AND c.status = 'open'
      AND c.assigned_to IS NULL
      AND has_any_role(auth.uid(), ARRAY[
        'sales_rep','support_agent','financial_agent','consultant'
      ]::app_role[])
      AND (
        c.department = (SELECT p.department FROM profiles p WHERE p.id = auth.uid())
        OR c.department IS NULL
      )
  )
);

-- ---------------------------------------------------------------
-- 2) messages DELETE
--    GAP: Só admin/manager via has_role(). Viola contrato de paridade.
--    FIX: Usar is_manager_or_admin() que inclui todos os cargos de gestão.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "role_based_delete_messages" ON messages;

CREATE POLICY "role_based_delete_messages" ON messages FOR DELETE
TO authenticated
USING (
  is_manager_or_admin(auth.uid())
);

-- ---------------------------------------------------------------
-- 3) messages INSERT
--    GAP: Usa has_role() individual para cada manager role (verboso mas funcional).
--    FIX: Consolidar com is_manager_or_admin() para consistência e performance.
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "role_based_insert_messages" ON messages;

CREATE POLICY "role_based_insert_messages" ON messages FOR INSERT
TO authenticated
WITH CHECK (
  is_manager_or_admin(auth.uid())
  OR
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = messages.conversation_id
      AND (
        c.assigned_to = auth.uid()
        OR c.assigned_to IS NULL
        OR c.department = (SELECT p.department FROM profiles p WHERE p.id = auth.uid())
      )
  )
);

-- ---------------------------------------------------------------
-- 4) conversation_queue ALL + SELECT
--    GAP: Só admin/manager via has_role(). Viola contrato de paridade.
--    FIX: Usar is_manager_or_admin().
-- ---------------------------------------------------------------
DROP POLICY IF EXISTS "Admin/Manager can manage queue" ON conversation_queue;
DROP POLICY IF EXISTS "Admin/Manager can view all queue items" ON conversation_queue;

CREATE POLICY "managers_can_manage_queue" ON conversation_queue FOR ALL
TO authenticated
USING (is_manager_or_admin(auth.uid()))
WITH CHECK (is_manager_or_admin(auth.uid()));

-- ---------------------------------------------------------------
-- 5) ai_suggestions UPDATE + DELETE
--    GAP: Só admin/manager via has_role/is_manager_or_admin.
--    UPDATE usa is_manager_or_admin ✅ mas com WITH CHECK redundante.
--    DELETE usa is_manager_or_admin ✅. Mantém como está.
-- ---------------------------------------------------------------
-- Já OK, sem alteração necessária.
