ALTER TABLE public.returns ADD COLUMN photos jsonb DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public) VALUES ('return-photos', 'return-photos', true);

CREATE POLICY "Public read access for return photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'return-photos');