
CREATE OR REPLACE FUNCTION public.get_ai_usage_metrics(
  p_start_date timestamptz,
  p_end_date timestamptz,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE(
  feature_type TEXT,
  usage_count BIGINT,
  unique_users BIGINT,
  sentiment_breakdown JSONB
)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH usage_data AS (
    SELECT 
      l.feature_type AS feat_type,
      COUNT(*) as total_count,
      COUNT(DISTINCT l.user_id) as user_count
    FROM public.ai_usage_logs l
    WHERE l.created_at BETWEEN p_start_date AND p_end_date
      AND (p_user_id IS NULL OR l.user_id = p_user_id)
      AND (l.result_data->>'fallback' IS NULL OR l.result_data->>'fallback' != 'true')
    GROUP BY l.feature_type
  ),
  sentiment_deduped AS (
    SELECT 
      CASE 
        WHEN al.result_data->>'sentiment' IN ('critico', 'crítico') THEN 'critico'
        WHEN al.result_data->>'sentiment' = 'promotor' THEN 'promotor'
        WHEN al.result_data->>'sentiment' = 'neutro' THEN 'neutro'
        ELSE NULL
      END as normalized_sentiment,
      al.conversation_id
    FROM public.ai_usage_logs al
    WHERE al.feature_type = 'sentiment'
      AND al.created_at BETWEEN p_start_date AND p_end_date
      AND (p_user_id IS NULL OR al.user_id = p_user_id)
      AND al.result_data->>'sentiment' IS NOT NULL
      AND (al.result_data->>'fallback' IS NULL OR al.result_data->>'fallback' != 'true')
      AND al.conversation_id IS NOT NULL
  ),
  sentiment_stats AS (
    SELECT
      jsonb_object_agg(
        normalized_sentiment,
        cnt
      ) as sentiment_data
    FROM (
      SELECT 
        normalized_sentiment,
        COUNT(DISTINCT conversation_id) as cnt
      FROM sentiment_deduped
      WHERE normalized_sentiment IS NOT NULL
      GROUP BY normalized_sentiment
    ) logs
  )
  SELECT 
    ud.feat_type::TEXT as feature_type,
    ud.total_count::BIGINT as usage_count,
    ud.user_count::BIGINT as unique_users,
    COALESCE(ss.sentiment_data, '{}'::jsonb) as sentiment_breakdown
  FROM usage_data ud
  CROSS JOIN sentiment_stats ss;
END;
$$;
