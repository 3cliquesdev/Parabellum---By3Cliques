
-- =============================================
-- Fix RLS: knowledge_articles - usar is_manager_or_admin()
-- =============================================

-- 1. Remover políticas SELECT antigas
DROP POLICY IF EXISTS "admin_manager_can_view_all_articles" ON public.knowledge_articles;
DROP POLICY IF EXISTS "support_agent_can_view_published_articles" ON public.knowledge_articles;

-- 2. Nova política: admins e todos os gerentes veem TUDO
CREATE POLICY "managers_admins_view_all_articles"
ON public.knowledge_articles
FOR SELECT
TO authenticated
USING (
  is_manager_or_admin(auth.uid())
);

-- 3. Support agents veem apenas artigos publicados
CREATE POLICY "support_agent_view_published_articles"
ON public.knowledge_articles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'support_agent') AND status = 'published'
);

-- =============================================
-- Fix RLS: knowledge_candidates - usar is_manager_or_admin()
-- =============================================

-- Remover política SELECT antiga
DROP POLICY IF EXISTS "managers_can_view_candidates" ON public.knowledge_candidates;

-- Nova política unificada
CREATE POLICY "managers_admins_view_all_candidates"
ON public.knowledge_candidates
FOR SELECT
TO authenticated
USING (
  is_manager_or_admin(auth.uid())
);
