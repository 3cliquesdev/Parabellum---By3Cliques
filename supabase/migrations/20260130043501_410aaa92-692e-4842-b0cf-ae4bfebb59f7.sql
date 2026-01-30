-- ==============================
-- FASE 6: Confiabilidade & Autonomia Operacional
-- ==============================

-- 1. Configuração Shadow Mode (ativo por padrão para segurança)
INSERT INTO system_configurations (key, value, category, description)
VALUES ('ai_shadow_mode', 'true', 'ai', 'Shadow Mode: IA sugere mas não aplica automaticamente')
ON CONFLICT (key) DO NOTHING;

-- 2. Tabela de Anomalias de IA
CREATE TABLE IF NOT EXISTS public.ai_anomaly_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  detected_at TIMESTAMPTZ DEFAULT now(),
  metric_type TEXT NOT NULL,           -- 'csat_drop', 'resolution_increase', 'adoption_drop'
  current_value NUMERIC NOT NULL,
  previous_value NUMERIC NOT NULL,
  change_percent NUMERIC NOT NULL,
  threshold_percent NUMERIC NOT NULL,
  severity TEXT DEFAULT 'warning',     -- 'warning', 'critical'
  department_id UUID REFERENCES departments(id),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID REFERENCES auth.users(id)
);

-- RLS para ai_anomaly_logs
ALTER TABLE ai_anomaly_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read anomalies"
  ON ai_anomaly_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can acknowledge anomalies"
  ON ai_anomaly_logs FOR UPDATE
  TO authenticated
  USING (true);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_anomaly_logs_detected ON ai_anomaly_logs(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomaly_logs_metric ON ai_anomaly_logs(metric_type);
CREATE INDEX IF NOT EXISTS idx_anomaly_logs_severity ON ai_anomaly_logs(severity);

-- 3. Tabela de Linha do Tempo de Aprendizado
CREATE TABLE IF NOT EXISTS public.ai_learning_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  learned_at TIMESTAMPTZ DEFAULT now(),
  learning_type TEXT NOT NULL,           -- 'kb', 'routing', 'reply', 'draft'
  summary TEXT NOT NULL,                 -- Descrição do aprendizado
  source_conversations INTEGER DEFAULT 0,
  source_conversation_ids UUID[],        -- Array de IDs das conversas fonte
  confidence TEXT DEFAULT 'média',       -- 'alta', 'média', 'baixa'
  status TEXT DEFAULT 'pending',         -- 'pending', 'approved', 'rejected'
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  related_article_id UUID REFERENCES knowledge_articles(id),
  department_id UUID REFERENCES departments(id),
  metadata JSONB DEFAULT '{}'
);

-- RLS para ai_learning_timeline
ALTER TABLE ai_learning_timeline ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read learning timeline"
  ON ai_learning_timeline FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can update learning status"
  ON ai_learning_timeline FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "System can insert learning events"
  ON ai_learning_timeline FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Índices para consultas frequentes
CREATE INDEX IF NOT EXISTS idx_learning_timeline_status ON ai_learning_timeline(status);
CREATE INDEX IF NOT EXISTS idx_learning_timeline_type ON ai_learning_timeline(learning_type);
CREATE INDEX IF NOT EXISTS idx_learning_timeline_learned ON ai_learning_timeline(learned_at DESC);