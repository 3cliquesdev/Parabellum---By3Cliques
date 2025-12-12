-- Tabela de histórico de saúde das instâncias WhatsApp
CREATE TABLE public.whatsapp_instance_health_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  status TEXT NOT NULL, -- 'connected', 'disconnected', 'restart_attempted', 'restart_success', 'restart_failed'
  detected_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  alert_sent BOOLEAN DEFAULT false,
  restart_attempts INT DEFAULT 0,
  error_message TEXT,
  api_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_health_log_instance_id ON whatsapp_instance_health_log(instance_id);
CREATE INDEX idx_health_log_detected_at ON whatsapp_instance_health_log(detected_at DESC);
CREATE INDEX idx_health_log_status ON whatsapp_instance_health_log(status);

-- Habilitar Realtime para whatsapp_instances (status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_instances;

-- Adicionar coluna last_health_check em whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS last_health_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS consecutive_failures INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_restart_enabled BOOLEAN DEFAULT true;

-- Habilitar RLS
ALTER TABLE public.whatsapp_instance_health_log ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para health log (apenas admins/managers podem ver)
CREATE POLICY "Admins and managers can view health logs"
ON public.whatsapp_instance_health_log
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'manager', 'general_manager', 'support_manager')
  )
);

-- Service role pode inserir (edge functions)
CREATE POLICY "Service role can insert health logs"
ON public.whatsapp_instance_health_log
FOR INSERT
WITH CHECK (true);