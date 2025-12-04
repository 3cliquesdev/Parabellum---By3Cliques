-- FASE 1: Tabela pivô para vínculo N:N entre playbooks e produtos
CREATE TABLE IF NOT EXISTS public.playbook_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES public.onboarding_playbooks(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(playbook_id, product_id)
);

-- Enable RLS
ALTER TABLE public.playbook_products ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin and manager can manage playbook_products"
ON public.playbook_products FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Authenticated users can view playbook_products"
ON public.playbook_products FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Migrar dados existentes (playbooks com product_id para a nova tabela)
INSERT INTO public.playbook_products (playbook_id, product_id)
SELECT id, product_id FROM public.onboarding_playbooks 
WHERE product_id IS NOT NULL
ON CONFLICT (playbook_id, product_id) DO NOTHING;