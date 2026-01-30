-- =================================================
-- FASE 5 OPCIONAL: Versão do Health Score + Tabela de Auditoria de Warnings
-- =================================================

-- 1. Dropar função existente para poder alterar retorno
DROP FUNCTION IF EXISTS public.get_copilot_health_score(TIMESTAMPTZ, TIMESTAMPTZ, UUID);

-- 2. Criar tabela para snapshot de insights críticos (warnings)
CREATE TABLE IF NOT EXISTS public.copilot_insights_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  action TEXT,
  confidence TEXT DEFAULT 'alta',
  health_score_at_time NUMERIC,
  total_conversations_at_time INTEGER,
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'ai',
  health_score_version TEXT DEFAULT 'v1',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. RLS: apenas leitura autenticada (gestores)
ALTER TABLE copilot_insights_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read insight events"
  ON copilot_insights_events FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert insight events"
  ON copilot_insights_events FOR INSERT
  TO service_role
  WITH CHECK (true);

-- 4. Índices para consultas de auditoria
CREATE INDEX IF NOT EXISTS idx_insight_events_type ON copilot_insights_events(insight_type);
CREATE INDEX IF NOT EXISTS idx_insight_events_created ON copilot_insights_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insight_events_department ON copilot_insights_events(department_id);
CREATE INDEX IF NOT EXISTS idx_insight_events_version ON copilot_insights_events(health_score_version);

-- 5. Recriar RPC get_copilot_health_score com health_score_version
CREATE OR REPLACE FUNCTION public.get_copilot_health_score(
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_conversations BIGINT,
  copilot_active_count BIGINT,
  copilot_adoption_rate NUMERIC,
  avg_resolution_time_with_copilot NUMERIC,
  avg_resolution_time_without_copilot NUMERIC,
  resolution_improvement_percent NUMERIC,
  avg_csat_with_copilot NUMERIC,
  avg_csat_without_copilot NUMERIC,
  csat_improvement_percent NUMERIC,
  kb_gap_count BIGINT,
  kb_coverage_rate NUMERIC,
  suggestions_used_total BIGINT,
  suggestions_available_total BIGINT,
  suggestion_usage_rate NUMERIC,
  health_score NUMERIC,
  adoption_component NUMERIC,
  kb_component NUMERIC,
  csat_component NUMERIC,
  usage_component NUMERIC,
  data_quality TEXT,
  health_score_version TEXT
) SECURITY DEFINER AS $$
DECLARE
  v_total BIGINT;
  v_copilot_count BIGINT;
  v_adoption NUMERIC;
  v_res_with NUMERIC;
  v_res_without NUMERIC;
  v_res_improvement NUMERIC;
  v_csat_with NUMERIC;
  v_csat_without NUMERIC;
  v_csat_improvement NUMERIC;
  v_kb_gaps BIGINT;
  v_kb_coverage NUMERIC;
  v_sugg_used BIGINT;
  v_sugg_avail BIGINT;
  v_sugg_rate NUMERIC;
  v_score NUMERIC;
  v_adoption_comp NUMERIC;
  v_kb_comp NUMERIC;
  v_csat_comp NUMERIC;
  v_usage_comp NUMERIC;
  v_data_quality TEXT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM agent_quality_metrics m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.created_at BETWEEN p_start_date AND p_end_date
    AND (p_department_id IS NULL OR c.department = p_department_id::text);
  
  SELECT COUNT(*) INTO v_copilot_count
  FROM agent_quality_metrics m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.created_at BETWEEN p_start_date AND p_end_date
    AND m.copilot_active = true
    AND (p_department_id IS NULL OR c.department = p_department_id::text);
  
  v_adoption := CASE WHEN v_total > 0 THEN ROUND((v_copilot_count::NUMERIC / v_total) * 100, 1) ELSE 0 END;
  
  SELECT COALESCE(AVG(resolution_time_seconds), 0) INTO v_res_with
  FROM agent_quality_metrics m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.created_at BETWEEN p_start_date AND p_end_date
    AND m.copilot_active = true
    AND m.resolution_time_seconds IS NOT NULL
    AND (p_department_id IS NULL OR c.department = p_department_id::text);
  
  SELECT COALESCE(AVG(resolution_time_seconds), 0) INTO v_res_without
  FROM agent_quality_metrics m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.created_at BETWEEN p_start_date AND p_end_date
    AND (m.copilot_active = false OR m.copilot_active IS NULL)
    AND m.resolution_time_seconds IS NOT NULL
    AND (p_department_id IS NULL OR c.department = p_department_id::text);
  
  v_res_improvement := CASE 
    WHEN v_res_without > 0 AND v_res_with > 0 
    THEN ROUND(((v_res_without - v_res_with) / v_res_without) * 100, 1)
    ELSE 0 
  END;
  
  SELECT COALESCE(AVG(csat_rating), 0) INTO v_csat_with
  FROM agent_quality_metrics m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.created_at BETWEEN p_start_date AND p_end_date
    AND m.copilot_active = true
    AND m.csat_rating IS NOT NULL
    AND (p_department_id IS NULL OR c.department = p_department_id::text);
  
  SELECT COALESCE(AVG(csat_rating), 0) INTO v_csat_without
  FROM agent_quality_metrics m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.created_at BETWEEN p_start_date AND p_end_date
    AND (m.copilot_active = false OR m.copilot_active IS NULL)
    AND m.csat_rating IS NOT NULL
    AND (p_department_id IS NULL OR c.department = p_department_id::text);
  
  v_csat_improvement := CASE 
    WHEN v_csat_without > 0 AND v_csat_with > 0 
    THEN ROUND(((v_csat_with - v_csat_without) / v_csat_without) * 100, 1)
    ELSE 0 
  END;
  
  SELECT COUNT(*) INTO v_kb_gaps
  FROM agent_quality_metrics m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.created_at BETWEEN p_start_date AND p_end_date
    AND m.created_kb_gap = true
    AND (p_department_id IS NULL OR c.department = p_department_id::text);
  
  v_kb_coverage := CASE WHEN v_total > 0 THEN ROUND(((v_total - v_kb_gaps)::NUMERIC / v_total) * 100, 1) ELSE 100 END;
  
  SELECT COALESCE(SUM(suggestions_used), 0) INTO v_sugg_used
  FROM agent_quality_metrics m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.created_at BETWEEN p_start_date AND p_end_date
    AND (p_department_id IS NULL OR c.department = p_department_id::text);
  
  SELECT COALESCE(SUM(suggestions_available), 0) INTO v_sugg_avail
  FROM agent_quality_metrics m
  JOIN conversations c ON c.id = m.conversation_id
  WHERE m.created_at BETWEEN p_start_date AND p_end_date
    AND (p_department_id IS NULL OR c.department = p_department_id::text);
  
  v_sugg_rate := CASE WHEN v_sugg_avail > 0 THEN ROUND((v_sugg_used::NUMERIC / v_sugg_avail) * 100, 1) ELSE 0 END;
  
  v_adoption_comp := ROUND((v_adoption / 100) * 25, 2);
  v_kb_comp := ROUND((v_kb_coverage / 100) * 25, 2);
  v_csat_comp := ROUND((COALESCE(v_csat_with, 3) * 20 / 100) * 25, 2);
  v_usage_comp := ROUND((v_sugg_rate / 100) * 25, 2);
  
  v_score := ROUND(v_adoption_comp + v_kb_comp + v_csat_comp + v_usage_comp, 0);
  
  v_data_quality := CASE 
    WHEN v_total >= 100 THEN 'alta'
    WHEN v_total >= 30 THEN 'média'
    ELSE 'baixa'
  END;
  
  RETURN QUERY SELECT
    v_total,
    v_copilot_count,
    v_adoption,
    ROUND(v_res_with, 0),
    ROUND(v_res_without, 0),
    v_res_improvement,
    ROUND(v_csat_with, 2),
    ROUND(v_csat_without, 2),
    v_csat_improvement,
    v_kb_gaps,
    v_kb_coverage,
    v_sugg_used,
    v_sugg_avail,
    v_sugg_rate,
    v_score,
    v_adoption_comp,
    v_kb_comp,
    v_csat_comp,
    v_usage_comp,
    v_data_quality,
    'v1'::text;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE copilot_insights_events IS 'Histórico de insights críticos (warnings) para auditoria e compliance';
COMMENT ON COLUMN copilot_insights_events.health_score_version IS 'Versão da fórmula do Health Score quando o insight foi gerado';