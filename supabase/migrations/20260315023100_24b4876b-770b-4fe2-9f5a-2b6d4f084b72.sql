
-- Tabela returns para sistema de devoluções
CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  external_order_id text NOT NULL,
  tracking_code_original text,
  tracking_code_return text,
  reason text NOT NULL CHECK (reason IN ('defeito', 'arrependimento', 'troca', 'nao_recebido', 'outro')),
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'refunded')),
  created_by text NOT NULL DEFAULT 'customer' CHECK (created_by IN ('customer', 'admin')),
  registered_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_returns_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_returns_updated
  BEFORE UPDATE ON public.returns
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_returns_updated_at();

-- Enable RLS
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "mgmt_all_returns"
  ON public.returns FOR ALL TO authenticated
  USING (public.is_manager_or_admin(auth.uid()))
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

-- Cliente SELECT: vinculado por contact_id (via email match) ou registered_email
CREATE POLICY "client_select_returns"
  ON public.returns FOR SELECT TO authenticated
  USING (
    contact_id IN (
      SELECT c.id FROM public.contacts c WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    OR registered_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Cliente INSERT: pode criar com created_by = 'customer'
CREATE POLICY "client_insert_returns"
  ON public.returns FOR INSERT TO authenticated
  WITH CHECK (
    created_by = 'customer'
    AND (
      contact_id IN (
        SELECT c.id FROM public.contacts c WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
      OR registered_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );

-- Index para buscas frequentes
CREATE INDEX idx_returns_contact_id ON public.returns(contact_id);
CREATE INDEX idx_returns_external_order_id ON public.returns(external_order_id);
CREATE INDEX idx_returns_status ON public.returns(status);
CREATE INDEX idx_returns_registered_email ON public.returns(registered_email);
