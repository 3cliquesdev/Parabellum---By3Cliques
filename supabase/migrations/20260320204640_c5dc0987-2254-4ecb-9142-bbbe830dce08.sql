CREATE OR REPLACE FUNCTION public.get_ai_resolution_metrics(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  total_closed         BIGINT,
  ai_resolved          BIGINT,
  human_resolved       BIGINT,
  mixed_resolved       BIGINT,
  human_handoff        BIGINT,
  unclassified         BIGINT,
  ai_resolution_rate   NUMERIC,
  human_rate           NUMERIC,
  handoff_rate         NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    COUNT(*)                                                                      AS total_closed,
    COUNT(*) FILTER (WHERE resolved_by = 'ai')                                   AS ai_resolved,
    COUNT(*) FILTER (WHERE resolved_by = 'human')                                AS human_resolved,
    COUNT(*) FILTER (WHERE resolved_by = 'mixed')                                AS mixed_resolved,
    COUNT(*) FILTER (WHERE resolved_by = 'human_handoff')                        AS human_handoff,
    COUNT(*) FILTER (WHERE resolved_by IS NULL)                                  AS unclassified,
    ROUND(
      COUNT(*) FILTER (WHERE resolved_by = 'ai') * 100.0
      / NULLIF(COUNT(*), 0), 1
    )                                                                             AS ai_resolution_rate,
    ROUND(
      COUNT(*) FILTER (WHERE resolved_by IN ('human', 'mixed')) * 100.0
      / NULLIF(COUNT(*), 0), 1
    )                                                                             AS human_rate,
    ROUND(
      COUNT(*) FILTER (WHERE resolved_by = 'human_handoff') * 100.0
      / NULLIF(COUNT(*), 0), 1
    )                                                                             AS handoff_rate
  FROM public.conversations
  WHERE status IN ('closed', 'resolved')
    AND created_at BETWEEN p_start_date AND p_end_date;
$$;

CREATE OR REPLACE FUNCTION public.get_ai_resolution_daily(
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date   TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  day          DATE,
  ai_resolved  BIGINT,
  human        BIGINT,
  handoff      BIGINT,
  total        BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    DATE(created_at)                                          AS day,
    COUNT(*) FILTER (WHERE resolved_by = 'ai')               AS ai_resolved,
    COUNT(*) FILTER (WHERE resolved_by IN ('human','mixed'))  AS human,
    COUNT(*) FILTER (WHERE resolved_by = 'human_handoff')    AS handoff,
    COUNT(*)                                                  AS total
  FROM public.conversations
  WHERE status IN ('closed', 'resolved')
    AND created_at BETWEEN p_start_date AND p_end_date
  GROUP BY DATE(created_at)
  ORDER BY day ASC;
$$;

COMMENT ON FUNCTION public.get_ai_resolution_metrics IS 'Métricas agregadas de resolução por IA vs humano em período';
COMMENT ON FUNCTION public.get_ai_resolution_daily IS 'Tendência diária de resolução por IA vs humano';