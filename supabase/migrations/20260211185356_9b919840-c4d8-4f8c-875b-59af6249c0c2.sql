CREATE POLICY "Authenticated users can read agent_departments"
ON public.agent_departments
FOR SELECT
USING (auth.uid() IS NOT NULL);