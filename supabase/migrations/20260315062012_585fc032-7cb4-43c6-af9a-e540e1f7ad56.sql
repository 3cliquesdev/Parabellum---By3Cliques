CREATE TABLE public.return_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  label text NOT NULL,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.return_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read return reasons"
  ON public.return_reasons FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can manage return reasons"
  ON public.return_reasons FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

INSERT INTO public.return_reasons (key, label, sort_order) VALUES
  ('defeito', 'Defeito no produto', 1),
  ('arrependimento', 'Arrependimento', 2),
  ('troca', 'Troca', 3),
  ('nao_recebido', 'Não recebi', 4),
  ('outro', 'Outro', 5);