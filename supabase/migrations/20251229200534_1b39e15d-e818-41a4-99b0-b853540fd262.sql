-- Tabela para log de distribuição de leads
CREATE TABLE public.lead_distribution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES public.deals(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  distribution_type TEXT NOT NULL DEFAULT 'manual',
  previous_assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_distribution_logs_assigned_to ON public.lead_distribution_logs(assigned_to);
CREATE INDEX idx_distribution_logs_created_at ON public.lead_distribution_logs(created_at);
CREATE INDEX idx_distribution_logs_deal_id ON public.lead_distribution_logs(deal_id);

-- RLS
ALTER TABLE public.lead_distribution_logs ENABLE ROW LEVEL SECURITY;

-- Política: Admin, manager, general_manager podem ver tudo
CREATE POLICY "Managers can view all distribution logs"
ON public.lead_distribution_logs FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'manager', 'general_manager')
  )
);

-- Política: Sales reps podem ver apenas logs onde são o assigned_to
CREATE POLICY "Sales reps can view own distribution logs"
ON public.lead_distribution_logs FOR SELECT
USING (assigned_to = auth.uid());

-- Política: Sistema pode inserir (via trigger)
CREATE POLICY "System can insert distribution logs"
ON public.lead_distribution_logs FOR INSERT
WITH CHECK (true);

-- Trigger para registrar distribuições automaticamente
CREATE OR REPLACE FUNCTION public.log_deal_distribution()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) AND NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.lead_distribution_logs (
      deal_id, contact_id, assigned_to, assigned_by, 
      distribution_type, previous_assigned_to, metadata
    ) VALUES (
      NEW.id, 
      NEW.contact_id, 
      NEW.assigned_to, 
      auth.uid(),
      CASE WHEN auth.uid() IS NULL THEN 'auto_round_robin' ELSE 'manual' END,
      OLD.assigned_to,
      jsonb_build_object(
        'deal_value', NEW.value, 
        'lead_source', NEW.lead_source,
        'deal_title', NEW.title
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_log_deal_distribution
AFTER UPDATE ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.log_deal_distribution();

-- Trigger para primeira atribuição (INSERT)
CREATE OR REPLACE FUNCTION public.log_deal_first_distribution()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL THEN
    INSERT INTO public.lead_distribution_logs (
      deal_id, contact_id, assigned_to, assigned_by, 
      distribution_type, previous_assigned_to, metadata
    ) VALUES (
      NEW.id, 
      NEW.contact_id, 
      NEW.assigned_to, 
      auth.uid(),
      CASE WHEN auth.uid() IS NULL THEN 'auto_round_robin' ELSE 'manual' END,
      NULL,
      jsonb_build_object(
        'deal_value', NEW.value, 
        'lead_source', NEW.lead_source,
        'deal_title', NEW.title
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_log_deal_first_distribution
AFTER INSERT ON public.deals
FOR EACH ROW
EXECUTE FUNCTION public.log_deal_first_distribution();

-- Adicionar permissão para relatório de distribuição de leads
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT r::app_role, 'reports.lead_distribution', 'Ver distribuição de leads', 'reports', 
  r IN ('admin', 'manager', 'general_manager')
FROM unnest(ARRAY['admin', 'general_manager', 'manager', 'sales_rep', 'consultant', 'support_agent', 'support_manager', 'financial_manager', 'cs_manager']) AS r
ON CONFLICT (role, permission_key) DO NOTHING;