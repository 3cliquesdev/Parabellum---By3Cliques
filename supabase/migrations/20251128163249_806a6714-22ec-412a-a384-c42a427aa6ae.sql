-- ============================================
-- FASE 1A: CPQ (Configure, Price, Quote)
-- Database Schema for Commercial Proposals
-- ============================================

-- 1. Create quote_status ENUM
CREATE TYPE quote_status AS ENUM (
  'draft',      -- Proposta em construção
  'sent',       -- Enviada ao cliente (link gerado)
  'viewed',     -- Cliente visualizou
  'accepted',   -- Cliente aceitou e assinou
  'rejected',   -- Cliente rejeitou
  'expired'     -- Expirou sem resposta
);

-- 2. Add price field to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) DEFAULT 0;

-- 3. Create quotes table
CREATE TABLE public.quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number TEXT NOT NULL UNIQUE, -- Número sequencial (ex: "Q-2024-001")
  deal_id UUID NOT NULL REFERENCES public.deals(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  
  -- Status and Lifecycle
  status quote_status NOT NULL DEFAULT 'draft',
  expiration_date DATE NOT NULL,
  
  -- Financial
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_percentage NUMERIC(5,2) DEFAULT 0, -- Desconto global
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  
  -- Digital Signature
  signature_token TEXT UNIQUE, -- Token público seguro para /p/:token
  signed_at TIMESTAMPTZ,
  signed_by_name TEXT, -- Nome completo do signatário
  signed_by_cpf TEXT, -- CPF do signatário
  signature_data TEXT, -- Base64 da assinatura canvas
  signature_ip TEXT, -- IP do signatário (auditoria)
  
  -- Files
  pdf_url TEXT, -- URL do PDF no Storage
  signed_pdf_url TEXT, -- PDF com assinatura embedded
  
  -- Rejection
  rejection_reason TEXT,
  rejected_at TIMESTAMPTZ,
  
  -- Tracking
  viewed_at TIMESTAMPTZ, -- Primeira visualização
  view_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_discount_percentage CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT valid_amounts CHECK (subtotal >= 0 AND total_amount >= 0)
);

-- 4. Create quote_items table (Products in Quote)
CREATE TABLE public.quote_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  
  -- Pricing
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10,2) NOT NULL, -- Preço unitário no momento da proposta
  discount_percentage NUMERIC(5,2) DEFAULT 0, -- Desconto por item
  discount_amount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL, -- (quantity * unit_price) - discount
  
  -- Order
  position INTEGER NOT NULL DEFAULT 0, -- Ordem de exibição
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_item_discount CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
  CONSTRAINT valid_item_total CHECK (total >= 0)
);

-- 5. Create function to generate quote numbers
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_sequence INTEGER;
  v_quote_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  
  -- Get next sequence number for current year
  SELECT COALESCE(MAX(
    CAST(
      SPLIT_PART(quote_number, '-', 3) AS INTEGER
    )
  ), 0) + 1
  INTO v_sequence
  FROM public.quotes
  WHERE quote_number LIKE 'Q-' || v_year || '-%';
  
  -- Format: Q-2024-001
  v_quote_number := 'Q-' || v_year || '-' || LPAD(v_sequence::TEXT, 3, '0');
  
  RETURN v_quote_number;
END;
$$;

-- 6. Create trigger to auto-generate quote_number
CREATE OR REPLACE FUNCTION public.set_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = '' THEN
    NEW.quote_number := public.generate_quote_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_quote_number
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_quote_number();

-- 7. Create trigger for updated_at
CREATE TRIGGER update_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Create indexes for performance
CREATE INDEX idx_quotes_deal_id ON public.quotes(deal_id);
CREATE INDEX idx_quotes_contact_id ON public.quotes(contact_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_signature_token ON public.quotes(signature_token);
CREATE INDEX idx_quotes_expiration_date ON public.quotes(expiration_date);
CREATE INDEX idx_quote_items_quote_id ON public.quote_items(quote_id);
CREATE INDEX idx_quote_items_product_id ON public.quote_items(product_id);

-- ============================================
-- RLS POLICIES
-- ============================================

-- Enable RLS
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

-- Quotes: Public can view via signature_token (for /p/:token route)
CREATE POLICY "public_can_view_quotes_by_token"
  ON public.quotes
  FOR SELECT
  USING (signature_token IS NOT NULL);

-- Quotes: Authenticated users role-based access
CREATE POLICY "role_based_select_quotes"
  ON public.quotes
  FOR SELECT
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    (has_role(auth.uid(), 'sales_rep'::app_role) AND (
      created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.deals d
        WHERE d.id = quotes.deal_id
        AND d.assigned_to = auth.uid()
      )
    ))
  );

CREATE POLICY "role_based_insert_quotes"
  ON public.quotes
  FOR INSERT
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    (has_role(auth.uid(), 'sales_rep'::app_role) AND (
      created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.deals d
        WHERE d.id = quotes.deal_id
        AND d.assigned_to = auth.uid()
      )
    ))
  );

CREATE POLICY "role_based_update_quotes"
  ON public.quotes
  FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role) OR
    (has_role(auth.uid(), 'sales_rep'::app_role) AND created_by = auth.uid())
  );

CREATE POLICY "role_based_delete_quotes"
  ON public.quotes
  FOR DELETE
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'manager'::app_role)
  );

-- Quote Items: Public can view items of public quotes
CREATE POLICY "public_can_view_quote_items"
  ON public.quote_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_items.quote_id
      AND q.signature_token IS NOT NULL
    )
  );

-- Quote Items: Authenticated users role-based access
CREATE POLICY "role_based_select_quote_items"
  ON public.quote_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_items.quote_id
      AND (
        has_role(auth.uid(), 'admin'::app_role) OR
        has_role(auth.uid(), 'manager'::app_role) OR
        (has_role(auth.uid(), 'sales_rep'::app_role) AND q.created_by = auth.uid())
      )
    )
  );

CREATE POLICY "role_based_insert_quote_items"
  ON public.quote_items
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_items.quote_id
      AND (
        has_role(auth.uid(), 'admin'::app_role) OR
        has_role(auth.uid(), 'manager'::app_role) OR
        (has_role(auth.uid(), 'sales_rep'::app_role) AND q.created_by = auth.uid())
      )
    )
  );

CREATE POLICY "role_based_update_quote_items"
  ON public.quote_items
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_items.quote_id
      AND (
        has_role(auth.uid(), 'admin'::app_role) OR
        has_role(auth.uid(), 'manager'::app_role) OR
        (has_role(auth.uid(), 'sales_rep'::app_role) AND q.created_by = auth.uid())
      )
    )
  );

CREATE POLICY "role_based_delete_quote_items"
  ON public.quote_items
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_items.quote_id
      AND (
        has_role(auth.uid(), 'admin'::app_role) OR
        has_role(auth.uid(), 'manager'::app_role)
      )
    )
  );

-- Public can update quote status (for signature acceptance)
CREATE POLICY "public_can_sign_quotes"
  ON public.quotes
  FOR UPDATE
  USING (signature_token IS NOT NULL)
  WITH CHECK (signature_token IS NOT NULL);

-- ============================================
-- COMMENTS (Documentation)
-- ============================================

COMMENT ON TABLE public.quotes IS 'Commercial proposals with digital signature capability';
COMMENT ON TABLE public.quote_items IS 'Line items (products) in commercial proposals';
COMMENT ON COLUMN public.quotes.signature_token IS 'Secure token for public quote access via /p/:token';
COMMENT ON COLUMN public.quotes.quote_number IS 'Sequential quote number (Q-YYYY-NNN)';
COMMENT ON FUNCTION public.generate_quote_number() IS 'Auto-generates sequential quote numbers by year';