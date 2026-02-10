
-- RPC: Consolidated support metrics (replaces 3 sequential calls)
CREATE OR REPLACE FUNCTION get_support_metrics_consolidated(p_start timestamptz, p_end timestamptz)
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_frt numeric;
  v_mttr numeric;
  v_csat numeric;
  v_ratings int;
BEGIN
  SELECT get_avg_first_response_time(p_start, p_end) INTO v_frt;
  SELECT get_avg_resolution_time(p_start, p_end) INTO v_mttr;
  SELECT COALESCE(AVG(rating), 0), COUNT(*) INTO v_csat, v_ratings
    FROM conversation_ratings
    WHERE created_at >= p_start AND created_at <= p_end;
  RETURN json_build_object(
    'avgFRT', COALESCE(v_frt, 0),
    'avgMTTR', COALESCE(v_mttr, 0),
    'avgCSAT', COALESCE(v_csat, 0),
    'totalRatings', COALESCE(v_ratings, 0)
  );
END;
$$;

-- RPC: Active conversation counts (replaces loading all conversations just to count)
CREATE OR REPLACE FUNCTION get_active_conversation_counts()
RETURNS json
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total', COUNT(*),
    'queued', COUNT(*) FILTER (WHERE assigned_to IS NULL)
  )
  FROM conversations
  WHERE status = 'open';
$$;
