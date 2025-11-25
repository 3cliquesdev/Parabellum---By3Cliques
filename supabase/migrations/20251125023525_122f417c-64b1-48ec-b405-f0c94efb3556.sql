-- Create AI usage tracking table
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  feature_type TEXT NOT NULL CHECK (feature_type IN ('summary', 'sentiment', 'reply', 'tags')),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE CASCADE,
  result_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_created_at ON public.ai_usage_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature_type ON public.ai_usage_logs(feature_type);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_user_id ON public.ai_usage_logs(user_id);

-- Enable RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admin/Manager can view all AI usage logs"
  ON public.ai_usage_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Sales rep can view own AI usage logs"
  ON public.ai_usage_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'sales_rep'::app_role) AND user_id = auth.uid());

CREATE POLICY "Authenticated users can insert AI usage logs"
  ON public.ai_usage_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Function to get AI usage metrics by period
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
      l.feature_type,
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
        result_data->>'sentiment',
        count
      ) as sentiment_data
    FROM (
      SELECT 
        result_data->>'sentiment' as sentiment,
        COUNT(*) as count
      FROM public.ai_usage_logs
      WHERE feature_type = 'sentiment'
        AND created_at BETWEEN p_start_date AND p_end_date
        AND (p_user_id IS NULL OR user_id = p_user_id)
        AND result_data->>'sentiment' IS NOT NULL
      GROUP BY result_data->>'sentiment'
    ) s
  )
  SELECT 
    ud.feature_type,
    SUM(ud.total_count)::BIGINT as usage_count,
    MAX(ud.user_count)::BIGINT as unique_users,
    COALESCE(ss.sentiment_data, '{}'::jsonb) as sentiment_breakdown
  FROM usage_data ud
  CROSS JOIN sentiment_stats ss
  GROUP BY ud.feature_type, ss.sentiment_data;
END;
$$;