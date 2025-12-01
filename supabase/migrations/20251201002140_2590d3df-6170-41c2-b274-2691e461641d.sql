-- Criar tabela de logs de falhas da IA para alertas ao admin
CREATE TABLE IF NOT EXISTS ai_failure_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  error_message TEXT NOT NULL,
  error_stack TEXT,
  customer_message TEXT,
  contact_id UUID REFERENCES contacts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_admin BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMPTZ
);

-- Index para buscar falhas recentes
CREATE INDEX idx_ai_failure_logs_created_at ON ai_failure_logs(created_at DESC);
CREATE INDEX idx_ai_failure_logs_notified ON ai_failure_logs(notified_admin, created_at);

-- RLS Policies
ALTER TABLE ai_failure_logs ENABLE ROW LEVEL SECURITY;

-- Admin/Manager podem ver todos os logs de falha
CREATE POLICY "admin_manager_can_view_ai_failure_logs"
ON ai_failure_logs FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Sistema pode inserir logs (authenticated)
CREATE POLICY "system_can_insert_ai_failure_logs"
ON ai_failure_logs FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

COMMENT ON TABLE ai_failure_logs IS 'Registra falhas da IA para alertar administradores e monitorar problemas críticos';