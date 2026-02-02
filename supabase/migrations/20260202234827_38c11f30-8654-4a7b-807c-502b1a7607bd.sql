-- Fix RLS to allow any authenticated user (scoped by contacts visibility) to manage customer tags
-- This addresses: "new row violates row-level security policy for table 'customer_tags'"

-- Ensure RLS is enabled (noop if already enabled)
ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;

-- Replace restrictive policies with contact-visibility-scoped policies
DROP POLICY IF EXISTS customer_tags_select_policy ON public.customer_tags;
DROP POLICY IF EXISTS customer_tags_insert_policy ON public.customer_tags;
DROP POLICY IF EXISTS customer_tags_delete_policy ON public.customer_tags;
DROP POLICY IF EXISTS customer_tags_update_policy ON public.customer_tags;

-- SELECT: user can see tags for contacts they can see (contacts RLS is respected)
CREATE POLICY customer_tags_select_authenticated
ON public.customer_tags
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = customer_tags.customer_id
  )
);

-- INSERT: user can add tags for contacts they can see; prefer created_by=auth.uid() but allow NULL for legacy clients
CREATE POLICY customer_tags_insert_authenticated
ON public.customer_tags
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = customer_tags.customer_id
  )
  AND (customer_tags.created_by IS NULL OR customer_tags.created_by = auth.uid())
);

-- DELETE: user can remove tags for contacts they can see
CREATE POLICY customer_tags_delete_authenticated
ON public.customer_tags
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.contacts c
    WHERE c.id = customer_tags.customer_id
  )
);

-- Helpful indexes for fast policy checks and joins
CREATE INDEX IF NOT EXISTS idx_customer_tags_customer_id ON public.customer_tags(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_tag_id ON public.customer_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_customer_tags_created_by ON public.customer_tags(created_by);
