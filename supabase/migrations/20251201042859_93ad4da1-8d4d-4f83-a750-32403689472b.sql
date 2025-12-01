-- ============================================
-- TABELA: kiwify_events (Auditoria de Eventos)
-- ============================================
CREATE TABLE IF NOT EXISTS public.kiwify_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  order_id TEXT NOT NULL,
  customer_email TEXT,
  product_id TEXT,
  offer_id TEXT,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para buscar eventos por tipo e ordem
CREATE INDEX IF NOT EXISTS idx_kiwify_events_event_type ON public.kiwify_events(event_type);
CREATE INDEX IF NOT EXISTS idx_kiwify_events_order_id ON public.kiwify_events(order_id);
CREATE INDEX IF NOT EXISTS idx_kiwify_events_created_at ON public.kiwify_events(created_at DESC);

-- ============================================
-- TABELA: admin_alerts (Sistema de Notificações)
-- ============================================
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'unmapped_product', 'sla_violation', etc
  title TEXT NOT NULL,
  message TEXT,
  metadata JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  read_at TIMESTAMPTZ
);

-- Index para buscar alertas não lidos
CREATE INDEX IF NOT EXISTS idx_admin_alerts_is_read ON public.admin_alerts(is_read);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_type ON public.admin_alerts(type);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_created_at ON public.admin_alerts(created_at DESC);

-- ============================================
-- RLS POLICIES: kiwify_events
-- ============================================
ALTER TABLE public.kiwify_events ENABLE ROW LEVEL SECURITY;

-- Admin/Manager podem visualizar todos eventos
CREATE POLICY "admin_manager_can_view_kiwify_events"
ON public.kiwify_events
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- ============================================
-- RLS POLICIES: admin_alerts
-- ============================================
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- Admin/Manager podem visualizar alertas
CREATE POLICY "admin_manager_can_view_alerts"
ON public.admin_alerts
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Admin/Manager podem marcar alertas como lidos
CREATE POLICY "admin_manager_can_update_alerts"
ON public.admin_alerts
FOR UPDATE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Admin/Manager podem deletar alertas
CREATE POLICY "admin_manager_can_delete_alerts"
ON public.admin_alerts
FOR DELETE
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

COMMENT ON TABLE public.kiwify_events IS 'Auditoria de todos eventos recebidos do webhook Kiwify';
COMMENT ON TABLE public.admin_alerts IS 'Sistema de notificações para administradores sobre eventos críticos';