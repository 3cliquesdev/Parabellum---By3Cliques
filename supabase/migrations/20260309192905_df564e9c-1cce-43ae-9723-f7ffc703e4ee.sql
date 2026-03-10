CREATE TABLE public.organization_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.organization_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage org phones"
  ON public.organization_phones FOR ALL TO authenticated USING (true) WITH CHECK (true);