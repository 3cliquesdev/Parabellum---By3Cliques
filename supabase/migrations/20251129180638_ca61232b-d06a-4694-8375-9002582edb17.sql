
-- Create cs_goals table for consultant monthly targets
CREATE TABLE IF NOT EXISTS public.cs_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- Primeiro dia do mês de referência
  target_gmv NUMERIC NOT NULL DEFAULT 0, -- Meta de volume transacionado pela carteira
  target_upsell NUMERIC NOT NULL DEFAULT 0, -- Meta de vendas adicionais (expansão)
  max_churn_rate NUMERIC NOT NULL DEFAULT 2.0, -- Teto de cancelamento aceitável (%)
  activation_count INTEGER NOT NULL DEFAULT 0, -- Quantos clientes novos ativar
  bonus_amount NUMERIC NOT NULL DEFAULT 0, -- Valor do bônus se bater todas as metas
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraint: Um consultor só pode ter uma meta por mês
  UNIQUE(consultant_id, month)
);

-- Enable RLS
ALTER TABLE public.cs_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "admin_manager_can_manage_cs_goals"
  ON public.cs_goals
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'cs_manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'cs_manager'::app_role));

CREATE POLICY "consultant_can_view_own_cs_goals"
  ON public.cs_goals
  FOR SELECT
  USING (has_role(auth.uid(), 'consultant'::app_role) AND consultant_id = auth.uid());

-- Create index for performance
CREATE INDEX idx_cs_goals_consultant_month ON public.cs_goals(consultant_id, month DESC);

-- Trigger for updated_at
CREATE TRIGGER update_cs_goals_updated_at
  BEFORE UPDATE ON public.cs_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.cs_goals IS 'Metas mensais dos consultores de Customer Success';
COMMENT ON COLUMN public.cs_goals.target_gmv IS 'Meta de volume transacionado pela carteira do consultor';
COMMENT ON COLUMN public.cs_goals.target_upsell IS 'Meta de vendas adicionais (expansão/upsell)';
COMMENT ON COLUMN public.cs_goals.max_churn_rate IS 'Taxa máxima de cancelamento aceitável (%)';
COMMENT ON COLUMN public.cs_goals.activation_count IS 'Número de clientes que devem ser ativados';
COMMENT ON COLUMN public.cs_goals.bonus_amount IS 'Valor do bônus se todas as metas forem atingidas';
