
-- RPC 1: Team Performance Consolidated
CREATE OR REPLACE FUNCTION public.get_team_performance_consolidated(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE(
  agent_id UUID,
  agent_name TEXT,
  avatar_url TEXT,
  chats_attended BIGINT,
  avg_response_minutes NUMERIC,
  avg_csat NUMERIC,
  total_csat_ratings BIGINT,
  sales_closed BIGINT,
  total_revenue NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH conv AS (
    SELECT
      c.assigned_to,
      COUNT(*) AS chats_attended,
      AVG(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 60.0)
        FILTER (WHERE c.first_response_at IS NOT NULL) AS avg_response_minutes
    FROM public.conversations c
    WHERE c.created_at >= p_start AND c.created_at < p_end
      AND c.assigned_to IS NOT NULL
    GROUP BY c.assigned_to
  ),
  csat AS (
    SELECT
      c.assigned_to,
      AVG(r.rating)::NUMERIC AS avg_csat,
      COUNT(*) AS total_csat_ratings
    FROM public.conversation_ratings r
    INNER JOIN public.conversations c ON c.id = r.conversation_id
    WHERE c.created_at >= p_start AND c.created_at < p_end
      AND c.assigned_to IS NOT NULL
    GROUP BY c.assigned_to
  ),
  sales AS (
    SELECT
      d.assigned_to,
      COUNT(*) AS sales_closed,
      COALESCE(SUM(d.value), 0)::NUMERIC AS total_revenue
    FROM public.deals d
    WHERE d.status = 'won'
      AND d.closed_at >= p_start AND d.closed_at < p_end
      AND d.assigned_to IS NOT NULL
    GROUP BY d.assigned_to
  )
  SELECT
    p.id AS agent_id,
    p.full_name AS agent_name,
    p.avatar_url,
    COALESCE(conv.chats_attended, 0) AS chats_attended,
    COALESCE(ROUND(conv.avg_response_minutes::NUMERIC, 1), 0) AS avg_response_minutes,
    COALESCE(ROUND(csat.avg_csat::NUMERIC, 1), 0) AS avg_csat,
    COALESCE(csat.total_csat_ratings, 0) AS total_csat_ratings,
    COALESCE(sales.sales_closed, 0) AS sales_closed,
    COALESCE(sales.total_revenue, 0) AS total_revenue
  FROM public.profiles p
  LEFT JOIN conv ON conv.assigned_to = p.id
  LEFT JOIN csat ON csat.assigned_to = p.id
  LEFT JOIN sales ON sales.assigned_to = p.id
  ORDER BY chats_attended DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_team_performance_consolidated(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- RPC 2: Channel Performance Consolidated
CREATE OR REPLACE FUNCTION public.get_channel_performance_consolidated(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE(
  channel TEXT,
  total_conversations BIGINT,
  closed_conversations BIGINT,
  conversion_rate NUMERIC,
  avg_csat NUMERIC,
  total_messages BIGINT,
  ai_handled BIGINT,
  human_handled BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH channel_stats AS (
    SELECT
      c.channel::TEXT,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE c.status = 'closed') AS closed,
      COUNT(*) FILTER (WHERE c.ai_mode = 'autopilot') AS ai_count
    FROM public.conversations c
    WHERE c.created_at >= p_start AND c.created_at < p_end
    GROUP BY c.channel
  ),
  message_counts AS (
    SELECT
      c.channel::TEXT,
      COUNT(m.id) AS msg_count
    FROM public.conversations c
    INNER JOIN public.messages m ON m.conversation_id = c.id
    WHERE c.created_at >= p_start AND c.created_at < p_end
    GROUP BY c.channel
  ),
  csat_per_channel AS (
    SELECT
      c.channel::TEXT,
      AVG(r.rating)::NUMERIC AS avg_rating
    FROM public.conversation_ratings r
    INNER JOIN public.conversations c ON c.id = r.conversation_id
    WHERE c.created_at >= p_start AND c.created_at < p_end
    GROUP BY c.channel
  )
  SELECT
    cs.channel,
    cs.total AS total_conversations,
    cs.closed AS closed_conversations,
    CASE WHEN cs.total > 0 
      THEN ROUND((cs.closed::NUMERIC / cs.total * 100), 2)
      ELSE 0
    END AS conversion_rate,
    COALESCE(ROUND(csat.avg_rating::NUMERIC, 1), 0) AS avg_csat,
    COALESCE(mc.msg_count, 0) AS total_messages,
    cs.ai_count AS ai_handled,
    (cs.total - cs.ai_count) AS human_handled
  FROM channel_stats cs
  LEFT JOIN message_counts mc ON mc.channel = cs.channel
  LEFT JOIN csat_per_channel csat ON csat.channel = cs.channel
  ORDER BY total_conversations DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_channel_performance_consolidated(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- RPC 3: Volume vs Resolution Consolidated
CREATE OR REPLACE FUNCTION public.get_volume_resolution_consolidated(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS TABLE(
  date_bucket TEXT,
  opened BIGINT,
  resolved BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH date_range AS (
    SELECT GENERATE_SERIES(
      DATE_TRUNC('day', p_start),
      DATE_TRUNC('day', p_end - INTERVAL '1 day'),
      INTERVAL '1 day'
    ) AS bucket
  ),
  opened_conv AS (
    SELECT
      DATE_TRUNC('day', c.created_at) AS bucket,
      COUNT(*) AS cnt
    FROM public.conversations c
    WHERE c.created_at >= p_start AND c.created_at < p_end
    GROUP BY DATE_TRUNC('day', c.created_at)
  ),
  resolved_conv AS (
    SELECT
      DATE_TRUNC('day', c.closed_at) AS bucket,
      COUNT(*) AS cnt
    FROM public.conversations c
    WHERE c.closed_at >= p_start AND c.closed_at < p_end
      AND c.closed_at IS NOT NULL
    GROUP BY DATE_TRUNC('day', c.closed_at)
  )
  SELECT
    TO_CHAR(dr.bucket, 'DD/MM') AS date_bucket,
    COALESCE(o.cnt, 0) AS opened,
    COALESCE(r.cnt, 0) AS resolved
  FROM date_range dr
  LEFT JOIN opened_conv o ON o.bucket = dr.bucket
  LEFT JOIN resolved_conv r ON r.bucket = dr.bucket
  ORDER BY dr.bucket;
$$;

GRANT EXECUTE ON FUNCTION public.get_volume_resolution_consolidated(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON public.conversations(created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_created ON public.conversations(assigned_to, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_closed_at ON public.conversations(closed_at);
CREATE INDEX IF NOT EXISTS idx_conversation_ratings_created ON public.conversation_ratings(created_at);
CREATE INDEX IF NOT EXISTS idx_deals_closed_status ON public.deals(closed_at, status);
CREATE INDEX IF NOT EXISTS idx_deals_assigned_status ON public.deals(assigned_to, status, closed_at);
