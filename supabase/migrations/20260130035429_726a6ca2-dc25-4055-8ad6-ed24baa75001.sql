-- ====================================================
-- FASE 4A: Expandir knowledge_articles para drafts de IA
-- ====================================================
ALTER TABLE public.knowledge_articles
  ADD COLUMN IF NOT EXISTS draft_from_gap_id UUID REFERENCES ai_suggestions(id),
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Índice para buscar drafts pendentes
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_drafts 
  ON knowledge_articles(source, is_published) 
  WHERE source = 'ai_draft' AND is_published = false;

-- ====================================================
-- FASE 4B: Criar tabela de métricas de qualidade
-- ====================================================
CREATE TABLE IF NOT EXISTS public.agent_quality_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  suggestions_used INTEGER DEFAULT 0,
  suggestions_available INTEGER DEFAULT 0,
  resolution_time_seconds INTEGER,
  created_kb_gap BOOLEAN DEFAULT false,
  copilot_active BOOLEAN DEFAULT false,
  csat_rating INTEGER,
  classification_label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Evitar duplicatas
  UNIQUE(agent_id, conversation_id)
);

-- RLS
ALTER TABLE public.agent_quality_metrics ENABLE ROW LEVEL SECURITY;

-- Índices para performance em dashboards
CREATE INDEX IF NOT EXISTS idx_agent_quality_agent 
  ON agent_quality_metrics(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_quality_date 
  ON agent_quality_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_quality_copilot 
  ON agent_quality_metrics(copilot_active) WHERE copilot_active = true;

-- RLS Policy: Gestores podem ver tudo, agentes veem só o próprio
CREATE POLICY "Managers can view all quality metrics"
  ON agent_quality_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('admin', 'general_manager', 'support_manager', 'cs_manager')
    )
    OR agent_id = auth.uid()
  );

-- Policy para INSERT (sistema interno)
CREATE POLICY "System can insert quality metrics"
  ON agent_quality_metrics FOR INSERT
  TO authenticated
  WITH CHECK (agent_id = auth.uid());

-- Policy para UPDATE (agente pode atualizar próprias métricas)
CREATE POLICY "Agents can update own quality metrics"
  ON agent_quality_metrics FOR UPDATE
  TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());