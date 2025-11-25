-- FASE 1: Tabela de Produtos e Regras de Negócio

-- Criar tabela products
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  requires_account_manager BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies para products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_can_view_products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "admins_can_manage_products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Adicionar product_id à tabela deals
ALTER TABLE public.deals
ADD COLUMN product_id UUID REFERENCES public.products(id);

-- Índice para melhor performance
CREATE INDEX idx_deals_product_id ON public.deals(product_id);