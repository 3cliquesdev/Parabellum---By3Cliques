DROP POLICY IF EXISTS "canonical_update_tickets" ON public.tickets;

CREATE POLICY "canonical_update_tickets" ON public.tickets
FOR UPDATE TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['admin','manager','general_manager','support_manager','cs_manager','financial_manager']::app_role[])
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (
    has_any_role(auth.uid(), ARRAY['consultant']::app_role[])
    AND customer_id IN (SELECT get_consultant_contact_ids(auth.uid()))
  )
)
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['admin','manager','general_manager','support_manager','cs_manager','financial_manager']::app_role[])
  OR assigned_to = auth.uid()
  OR created_by = auth.uid()
  OR (
    has_any_role(auth.uid(), ARRAY['consultant']::app_role[])
    AND customer_id IN (SELECT get_consultant_contact_ids(auth.uid()))
  )
);