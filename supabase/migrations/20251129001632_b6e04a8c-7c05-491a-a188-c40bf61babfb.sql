-- FASE 1: Database Schema - SLA Alerts Table

CREATE TABLE sla_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'frt_violation',
  threshold_minutes INTEGER NOT NULL DEFAULT 10,
  actual_minutes NUMERIC NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notified_managers JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para busca rápida de alertas ativos
CREATE INDEX idx_sla_alerts_active ON sla_alerts(status) WHERE status = 'active';

-- Index para relacionamento com conversas
CREATE INDEX idx_sla_alerts_conversation ON sla_alerts(conversation_id);

-- Constraint única para evitar alertas duplicados
CREATE UNIQUE INDEX idx_sla_alerts_unique_active 
ON sla_alerts(conversation_id) 
WHERE status = 'active';

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE sla_alerts;

-- RLS Policies
ALTER TABLE sla_alerts ENABLE ROW LEVEL SECURITY;

-- Admin/Manager podem ver e gerenciar todos os alertas
CREATE POLICY "admin_manager_can_view_all_sla_alerts"
ON sla_alerts FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "admin_manager_can_manage_sla_alerts"
ON sla_alerts FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Support agents podem ver alertas do seu departamento
CREATE POLICY "support_agent_can_view_dept_alerts"
ON sla_alerts FOR SELECT
USING (
  has_role(auth.uid(), 'support_agent'::app_role) AND
  EXISTS (
    SELECT 1 FROM conversations c
    INNER JOIN profiles p ON p.id = auth.uid()
    WHERE c.id = sla_alerts.conversation_id
    AND c.department = p.department
  )
);