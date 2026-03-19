
CREATE TABLE public.product_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.product_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read product_tags"
  ON public.product_tags FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage product_tags"
  ON public.product_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.product_tags (name)
SELECT DISTINCT unnest(product_tags) FROM public.knowledge_articles
WHERE product_tags IS NOT NULL AND array_length(product_tags, 1) > 0
ON CONFLICT (name) DO NOTHING;
