
-- Tabela de canais de venda dinâmicos
CREATE TABLE public.sales_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text DEFAULT '💳',
  requires_order_id boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);

-- RLS
ALTER TABLE public.sales_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sales_channels"
  ON public.sales_channels FOR SELECT TO authenticated USING (true);

CREATE POLICY "Managers can insert sales_channels"
  ON public.sales_channels FOR INSERT TO authenticated
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Managers can update sales_channels"
  ON public.sales_channels FOR UPDATE TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Managers can delete sales_channels"
  ON public.sales_channels FOR DELETE TO authenticated
  USING (public.is_manager_or_admin(auth.uid()));

-- Seed com canais iniciais
INSERT INTO public.sales_channels (name, slug, icon, requires_order_id) VALUES
  ('FForder', 'fforder', '📦', true),
  ('PIX Direto', 'pix_direto', '💰', false),
  ('Boleto', 'boleto', '🏦', false),
  ('Cartão Direto', 'cartao_direto', '💳', false),
  ('Transferência', 'transferencia', '🔄', false);
