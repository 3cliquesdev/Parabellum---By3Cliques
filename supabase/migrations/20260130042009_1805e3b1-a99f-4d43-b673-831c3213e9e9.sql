-- ============================================================
-- Ajuste A: Recriar RPC get_copilot_health_score com componentes explicáveis
-- Primeiro DROP, depois CREATE com nova assinatura
-- ============================================================

DROP FUNCTION IF EXISTS get_copilot_health_score(TIMESTAMPTZ, TIMESTAMPTZ, UUID);

CREATE OR REPLACE FUNCTION get_copilot_health_score(
  p_start_date TIMESTAMPTZ DEFAULT (CURRENT_DATE - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT CURRENT_DATE,
  p_department_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_conversations BIGINT,
  copilot_active_count BIGINT,
  copilot_adoption_rate NUMERIC,
  avg_resolution_time_with_copilot INTEGER,
  avg_resolution_time_without_copilot INTEGER,
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
  data_quality TEXT
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  WITH metrics AS (
    SELECT
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE m.copilot_active = true) as active,
      AVG(m.resolution_time_seconds) FILTER (WHERE m.copilot_active = true) as res_with,
      AVG(m.resolution_time_seconds) FILTER (WHERE m.copilot_active = false OR m.copilot_active IS NULL) as res_without,
      AVG(m.csat_rating::numeric) FILTER (WHERE m.copilot_active = true AND m.csat_rating IS NOT NULL) as csat_with,
      AVG(m.csat_rating::numeric) FILTER (WHERE (m.copilot_active = false OR m.copilot_active IS NULL) AND m.csat_rating IS NOT NULL) as csat_without,
      COUNT(*) FILTER (WHERE m.created_kb_gap = true) as gaps,
      SUM(COALESCE(m.suggestions_used, 0)) as used,
      SUM(COALESCE(m.suggestions_available, 0)) as available
    FROM agent_quality_metrics m
    LEFT JOIN conversations c ON m.conversation_id = c.id
    WHERE m.created_at BETWEEN p_start_date AND p_end_date
      AND (p_department_id IS NULL OR c.department = p_department_id::text)
  ),
  calculated AS (
    SELECT
      m.total,
      m.active,
      ROUND(CASE WHEN m.total > 0 THEN (m.active::numeric / m.total) * 100 ELSE 0 END, 1) as adoption_rate,
      COALESCE(m.res_with, 0)::integer as res_with_int,
      COALESCE(m.res_without, 0)::integer as res_without_int,
      ROUND(CASE WHEN m.res_without > 0 THEN ((m.res_without - m.res_with) / m.res_without) * 100 ELSE 0 END, 1) as res_improvement,
      ROUND(COALESCE(m.csat_with, 0), 2) as csat_with_val,
      ROUND(COALESCE(m.csat_without, 0), 2) as csat_without_val,
      ROUND(CASE WHEN m.csat_without > 0 THEN ((m.csat_with - m.csat_without) / m.csat_without) * 100 ELSE 0 END, 1) as csat_improvement,
      m.gaps,
      ROUND(CASE WHEN m.total > 0 THEN ((m.total - m.gaps)::numeric / m.total) * 100 ELSE 100 END, 1) as kb_coverage,
      m.used,
      m.available,
      ROUND(CASE WHEN m.available > 0 THEN (m.used::numeric / m.available) * 100 ELSE 0 END, 1) as usage_rate,
      ROUND(CASE WHEN m.total > 0 THEN (m.active::numeric / m.total) * 25 ELSE 0 END, 1) as adopt_comp,
      ROUND(CASE WHEN m.total > 0 THEN ((m.total - m.gaps)::numeric / m.total) * 25 ELSE 25 END, 1) as kb_comp,
      ROUND(COALESCE(m.csat_with * 5, 12.5), 1) as csat_comp,
      ROUND(CASE WHEN m.available > 0 THEN (m.used::numeric / m.available) * 25 ELSE 0 END, 1) as usage_comp,
      CASE 
        WHEN m.total >= 100 THEN 'alta'
        WHEN m.total >= 30 THEN 'média'
        ELSE 'baixa'
      END as data_qual
    FROM metrics m
  )
  SELECT
    c.total,
    c.active,
    c.adoption_rate,
    c.res_with_int,
    c.res_without_int,
    c.res_improvement,
    c.csat_with_val,
    c.csat_without_val,
    c.csat_improvement,
    c.gaps,
    c.kb_coverage,
    c.used,
    c.available,
    c.usage_rate,
    ROUND(c.adopt_comp + c.kb_comp + c.csat_comp + c.usage_comp, 0),
    c.adopt_comp,
    c.kb_comp,
    c.csat_comp,
    c.usage_comp,
    c.data_qual
  FROM calculated c;
END;
$$;

-- ============================================================
-- Ajuste C: Criar tabela de cache para insights
-- ============================================================

CREATE TABLE IF NOT EXISTS public.copilot_insights_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT UNIQUE NOT NULL,
  insights JSONB NOT NULL,
  source TEXT DEFAULT 'ai',
  confidence TEXT DEFAULT 'alta',
  total_conversations INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '12 hours')
);

ALTER TABLE public.copilot_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read insights cache"
  ON public.copilot_insights_cache FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_insights_cache_key ON public.copilot_insights_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_insights_cache_expires ON public.copilot_insights_cache(expires_at);

CREATE OR REPLACE FUNCTION cleanup_expired_insights_cache()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.copilot_insights_cache WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE public.copilot_insights_cache IS 'Cache de insights gerados por IA com TTL de 12 horas';
COMMENT ON COLUMN public.copilot_insights_cache.cache_key IS 'Chave única: period_departmentId';
COMMENT ON COLUMN public.copilot_insights_cache.confidence IS 'Nível de confiança: alta ou média';