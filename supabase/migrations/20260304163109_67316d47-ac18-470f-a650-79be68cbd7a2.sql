CREATE TABLE public.contact_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, tag_id)
);

ALTER TABLE public.contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read contact_tags"
  ON public.contact_tags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert contact_tags"
  ON public.contact_tags FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete contact_tags"
  ON public.contact_tags FOR DELETE TO authenticated USING (true);

CREATE POLICY "Service role full access contact_tags"
  ON public.contact_tags FOR ALL TO service_role USING (true) WITH CHECK (true);