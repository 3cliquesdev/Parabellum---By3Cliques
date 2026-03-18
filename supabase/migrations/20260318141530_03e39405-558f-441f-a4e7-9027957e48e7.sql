
DROP POLICY IF EXISTS optimized_inbox_select ON public.inbox_view;

CREATE POLICY optimized_inbox_select ON public.inbox_view
FOR SELECT TO authenticated
USING (
  -- Full access roles
  has_any_role(auth.uid(), ARRAY['admin','manager','general_manager',
    'support_manager','cs_manager','financial_manager']::app_role[])
  -- Assigned to me
  OR (assigned_to = auth.uid())
  -- My department (open, unassigned or same dept)
  OR (
    has_any_role(auth.uid(), ARRAY['sales_rep','support_agent',
      'financial_agent','consultant']::app_role[])
    AND (
      (department = (SELECT profiles.department FROM profiles WHERE profiles.id = auth.uid()))
      OR (assigned_to IS NULL AND department IS NULL)
    )
  )
  -- AI queue global visibility (autopilot/waiting_human, unassigned, not closed)
  OR (
    ai_mode IN ('autopilot', 'waiting_human')
    AND status <> 'closed'
    AND assigned_to IS NULL
    AND has_any_role(auth.uid(), ARRAY['admin','manager','general_manager',
      'support_manager','cs_manager','financial_manager','sales_rep',
      'support_agent','financial_agent','consultant']::app_role[])
  )
);
