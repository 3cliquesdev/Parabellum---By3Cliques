-- Fix ambiguous column reference in get_ai_usage_metrics function
-- Bug #5: Add explicit table aliases to all column references

CREATE OR REPLACE FUNCTION public.get_ai_usage_metrics(
  p_start_date TIMESTAMP WITH TIME ZONE,
  p_end_date TIMESTAMP WITH TIME ZONE,
  p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
  feature_type TEXT,
  usage_count BIGINT,
  unique_users BIGINT,
  sentiment_breakdown JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH usage_data AS (
    SELECT 
      l.feature_type AS feat_type,
      COUNT(*) as total_count,
      COUNT(DISTINCT l.user_id) as user_count,
      l.result_data
    FROM public.ai_usage_logs l
    WHERE l.created_at BETWEEN p_start_date AND p_end_date
      AND (p_user_id IS NULL OR l.user_id = p_user_id)
    GROUP BY l.feature_type, l.result_data
  ),
  sentiment_stats AS (
    SELECT
      jsonb_object_agg(
        logs.sentiment,
        logs.cnt
      ) as sentiment_data
    FROM (
      SELECT 
        al.result_data->>'sentiment' as sentiment,
        COUNT(*) as cnt
      FROM public.ai_usage_logs al
      WHERE al.feature_type = 'sentiment'
        AND al.created_at BETWEEN p_start_date AND p_end_date
        AND (p_user_id IS NULL OR al.user_id = p_user_id)
        AND al.result_data->>'sentiment' IS NOT NULL
      GROUP BY al.result_data->>'sentiment'
    ) logs
  )
  SELECT 
    ud.feat_type::TEXT as feature_type,
    SUM(ud.total_count)::BIGINT as usage_count,
    MAX(ud.user_count)::BIGINT as unique_users,
    COALESCE(ss.sentiment_data, '{}'::jsonb) as sentiment_breakdown
  FROM usage_data ud
  CROSS JOIN sentiment_stats ss
  GROUP BY ud.feat_type, ss.sentiment_data;
END;
$$;