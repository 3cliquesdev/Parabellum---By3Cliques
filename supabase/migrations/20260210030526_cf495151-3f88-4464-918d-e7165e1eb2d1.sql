
-- 1. Tabela ticket_origins
CREATE TABLE public.ticket_origins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6B7280',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_origins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read origins"
  ON public.ticket_origins FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage origins"
  ON public.ticket_origins FOR ALL
  USING (has_any_role(auth.uid(), ARRAY['admin'::app_role, 'manager'::app_role, 'general_manager'::app_role]));

-- 2. Seed
INSERT INTO public.ticket_origins (name, color) VALUES
  ('Dúvidas gerais (Suporte)', '#9b87f5'),
  ('Onboarding / Assinatura (Comercial)', '#F97316'),
  ('Antes do pagamento', '#EAB308'),
  ('Pago e não enviado', '#EF4444'),
  ('Enviado, mas não entregue', '#8B5CF6'),
  ('Após a entrega / confirmação de não entrega', '#06B6D4'),
  ('Deixou de ser cliente', '#6B7280');

-- 3. Coluna origin_id em tickets
ALTER TABLE public.tickets ADD COLUMN origin_id UUID REFERENCES public.ticket_origins(id) ON DELETE SET NULL;
