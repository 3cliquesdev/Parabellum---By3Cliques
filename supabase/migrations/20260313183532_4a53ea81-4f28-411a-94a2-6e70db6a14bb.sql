CREATE POLICY "Authenticated users can view meta instances"
ON public.whatsapp_meta_instances
FOR SELECT
USING (auth.uid() IS NOT NULL);