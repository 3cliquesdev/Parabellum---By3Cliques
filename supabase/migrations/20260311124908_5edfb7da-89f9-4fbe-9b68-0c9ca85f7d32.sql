CREATE POLICY "Authenticated users can view chat flows"
ON public.chat_flows
FOR SELECT
TO authenticated
USING (true);