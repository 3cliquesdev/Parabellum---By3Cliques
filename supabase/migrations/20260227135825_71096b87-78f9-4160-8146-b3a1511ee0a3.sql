
-- Drop and recreate to force PostgREST to pick up the correct signature
DROP FUNCTION IF EXISTS public.get_inbox_time_report(
  timestamp with time zone, timestamp with time zone,
  uuid, uuid, text, text, uuid, text, text, integer, integer
);

CREATE OR REPLACE FUNCTION public.get_inbox_time_report(
  p_start timestamptz,
  p_end timestamptz,
  p_department_id uuid DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_channel text DEFAULT NULL,
  p_tag_id uuid DEFAULT NULL,
  p_transferred text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  conversation_id uuid,
  short_id text,
  channel text,
  status text,
  contact_name text,
  contact_phone text,
  assigned_agent_name text,
  department_name text,
  customer_first_msg_at timestamptz,
  ai_first_msg_at timestamptz,
  handoff_at timestamptz,
  agent_first_msg_at timestamptz,
  resolved_at timestamptz,
  ai_first_response_sec double precision,
  ai_duration_sec double precision,
  time_to_handoff_sec double precision,
  human_pickup_sec double precision,
  human_resolution_sec double precision,
  total_resolution_sec double precision,
  csat_score integer,
  tags_all text[],
  total_count bigint,
  kpi_avg_ai_first_response double precision,
  kpi_avg_ai_duration double precision,
  kpi_avg_human_pickup double precision,
  kpi_avg_human_resolution double precision,
  kpi_avg_total_resolution double precision,
  kpi_p50_ai_first_response double precision,
  kpi_p90_ai_first_response double precision,
  kpi_pct_resolved_no_human double precision,
  kpi_avg_csat double precision,
  kpi_csat_response_rate double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      c.id AS conv_id,
      LEFT(c.id::text, 8) AS sid,
      c.channel::text AS ch,
      c.status::text AS st,
      COALESCE(ct.first_name || ' ' || ct.last_name, ct.first_name, '') AS cname,
      COALESCE(ct.phone, '') AS cphone,
      COALESCE(p.full_name, '') AS aname,
      COALESCE(d.name, '') AS dname,
      c.handoff_executed_at AS ho_at,
      c.closed_at AS res_at,
      (SELECT MIN(m.created_at) FROM messages m WHERE m.conversation_id = c.id AND m.sender_type = 'contact') AS cfm,
      (SELECT MIN(m.created_at) FROM messages m WHERE m.conversation_id = c.id AND m.is_ai_generated = true) AS afm,
      (SELECT MIN(m.created_at) FROM messages m WHERE m.conversation_id = c.id AND m.sender_type = 'user' AND m.is_ai_generated = false AND (c.handoff_executed_at IS NULL OR m.created_at > c.handoff_executed_at)) AS agfm,
      (SELECT cr.rating FROM conversation_ratings cr WHERE cr.conversation_id = c.id ORDER BY cr.created_at DESC LIMIT 1) AS csat,
      (SELECT ARRAY_AGG(t.name ORDER BY t.name) FROM conversation_tags ctg JOIN tags t ON t.id = ctg.tag_id WHERE ctg.conversation_id = c.id) AS tgs
    FROM conversations c
    LEFT JOIN contacts ct ON ct.id = c.contact_id
    LEFT JOIN profiles p ON p.id = c.assigned_to
    LEFT JOIN departments d ON d.id = c.department
    WHERE c.created_at >= p_start
      AND c.created_at < p_end
      AND (p_department_id IS NULL OR c.department = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_status IS NULL OR c.status::text = p_status)
      AND (p_channel IS NULL OR c.channel::text = p_channel)
      AND (p_tag_id IS NULL OR EXISTS (SELECT 1 FROM conversation_tags ctg2 WHERE ctg2.conversation_id = c.id AND ctg2.tag_id = p_tag_id))
      AND (p_transferred IS NULL OR p_transferred = '' OR
           (p_transferred = 'true' AND c.handoff_executed_at IS NOT NULL) OR
           (p_transferred = 'false' AND c.handoff_executed_at IS NULL))
      AND (p_search IS NULL OR p_search = '' OR
           LEFT(c.id::text, 8) ILIKE '%' || p_search || '%' OR
           ct.first_name ILIKE '%' || p_search || '%' OR
           ct.last_name ILIKE '%' || p_search || '%' OR
           ct.phone ILIKE '%' || p_search || '%')
  ),
  metrics AS (
    SELECT
      b.*,
      EXTRACT(EPOCH FROM (b.afm - b.cfm))::double precision AS ai_fr_sec,
      EXTRACT(EPOCH FROM (b.ho_at - b.afm))::double precision AS ai_dur_sec,
      EXTRACT(EPOCH FROM (b.ho_at - b.cfm))::double precision AS tth_sec,
      EXTRACT(EPOCH FROM (b.agfm - b.ho_at))::double precision AS hp_sec,
      EXTRACT(EPOCH FROM (b.res_at - b.agfm))::double precision AS hr_sec,
      EXTRACT(EPOCH FROM (b.res_at - b.cfm))::double precision AS tr_sec
    FROM base b
  ),
  agg AS (
    SELECT
      COUNT(*)::bigint AS tc,
      (AVG(ai_fr_sec) FILTER (WHERE ai_fr_sec > 0))::double precision AS avg_ai_fr,
      (AVG(ai_dur_sec) FILTER (WHERE ai_dur_sec > 0))::double precision AS avg_ai_dur,
      (AVG(hp_sec) FILTER (WHERE hp_sec > 0))::double precision AS avg_hp,
      (AVG(hr_sec) FILTER (WHERE hr_sec > 0))::double precision AS avg_hr,
      (AVG(tr_sec) FILTER (WHERE tr_sec > 0))::double precision AS avg_tr,
      (PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ai_fr_sec) FILTER (WHERE ai_fr_sec > 0))::double precision AS p50_ai_fr,
      (PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY ai_fr_sec) FILTER (WHERE ai_fr_sec > 0))::double precision AS p90_ai_fr,
      CASE WHEN COUNT(*) > 0 THEN
        COUNT(*) FILTER (WHERE ho_at IS NULL AND st = 'closed')::double precision / COUNT(*)::double precision * 100
      ELSE 0 END AS pct_no_human,
      (AVG(csat) FILTER (WHERE csat IS NOT NULL))::double precision AS avg_csat,
      CASE WHEN COUNT(*) > 0 THEN
        COUNT(*) FILTER (WHERE csat IS NOT NULL)::double precision / COUNT(*)::double precision * 100
      ELSE 0 END AS csat_rr
    FROM metrics
  )
  SELECT
    m.conv_id,
    m.sid,
    m.ch,
    m.st,
    m.cname,
    m.cphone,
    m.aname,
    m.dname,
    m.cfm,
    m.afm,
    m.ho_at,
    m.agfm,
    m.res_at,
    m.ai_fr_sec,
    m.ai_dur_sec,
    m.tth_sec,
    m.hp_sec,
    m.hr_sec,
    m.tr_sec,
    m.csat,
    COALESCE(m.tgs, ARRAY[]::text[]),
    a.tc,
    a.avg_ai_fr,
    a.avg_ai_dur,
    a.avg_hp,
    a.avg_hr,
    a.avg_tr,
    a.p50_ai_fr,
    a.p90_ai_fr,
    a.pct_no_human,
    a.avg_csat,
    a.csat_rr
  FROM metrics m
  CROSS JOIN agg a
  ORDER BY m.cfm DESC NULLS LAST
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;

-- Grant access
GRANT EXECUTE ON FUNCTION public.get_inbox_time_report TO anon, authenticated;

-- Force PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
