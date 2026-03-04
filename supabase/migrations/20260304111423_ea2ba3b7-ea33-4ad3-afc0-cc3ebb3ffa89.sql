-- Update get_ai_usage_metrics to exclude fallback results and normalize sentiments
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
      COUNT(DISTINCT l.user_id) as user_count
    FROM public.ai_usage_logs l
    WHERE l.created_at BETWEEN p_start_date AND p_end_date
      AND (p_user_id IS NULL OR l.user_id = p_user_id)
      -- Exclude fallback results from counts
      AND (l.result_data->>'fallback' IS NULL OR l.result_data->>'fallback' != 'true')
    GROUP BY l.feature_type
  ),
  sentiment_stats AS (
    SELECT
      jsonb_object_agg(
        normalized_sentiment,
        cnt
      ) as sentiment_data
    FROM (
      SELECT 
        -- Normalize: merge critico/crítico, only allow valid values
        CASE 
          WHEN al.result_data->>'sentiment' IN ('critico', 'crítico') THEN 'critico'
          WHEN al.result_data->>'sentiment' = 'promotor' THEN 'promotor'
          WHEN al.result_data->>'sentiment' = 'neutro' THEN 'neutro'
          ELSE NULL
        END as normalized_sentiment,
        COUNT(*) as cnt
      FROM public.ai_usage_logs al
      WHERE al.feature_type = 'sentiment'
        AND al.created_at BETWEEN p_start_date AND p_end_date
        AND (p_user_id IS NULL OR al.user_id = p_user_id)
        AND al.result_data->>'sentiment' IS NOT NULL
        -- Exclude fallback results from sentiment metrics
        AND (al.result_data->>'fallback' IS NULL OR al.result_data->>'fallback' != 'true')
      GROUP BY CASE 
          WHEN al.result_data->>'sentiment' IN ('critico', 'crítico') THEN 'critico'
          WHEN al.result_data->>'sentiment' = 'promotor' THEN 'promotor'
          WHEN al.result_data->>'sentiment' = 'neutro' THEN 'neutro'
          ELSE NULL
        END
    ) logs
    WHERE logs.normalized_sentiment IS NOT NULL
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