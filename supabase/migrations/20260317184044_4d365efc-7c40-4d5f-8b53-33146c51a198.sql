
CREATE POLICY "agent_manage_returns" ON public.returns
FOR ALL TO authenticated
USING (
  has_any_role(auth.uid(), ARRAY['support_agent','financial_agent','consultant','sales_rep']::app_role[])
)
WITH CHECK (
  has_any_role(auth.uid(), ARRAY['support_agent','financial_agent','consultant','sales_rep']::app_role[])
);
