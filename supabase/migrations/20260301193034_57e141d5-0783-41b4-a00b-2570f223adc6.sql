
-- =============================================
-- RPC 1: get_inbox_time_report — fill agent/department fallbacks
-- =============================================
CREATE OR REPLACE FUNCTION public.get_inbox_time_report(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
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
  conversation_id uuid, short_id text, channel text, status text,
  contact_name text, contact_phone text, assigned_agent_name text, department_name text,
  customer_first_msg_at timestamptz, ai_first_msg_at timestamptz, handoff_at timestamptz,
  agent_first_msg_at timestamptz, resolved_at timestamptz,
  ai_first_response_sec double precision, ai_duration_sec double precision,
  time_to_handoff_sec double precision, human_pickup_sec double precision,
  human_resolution_sec double precision, total_resolution_sec double precision,
  csat_score integer, tags_all text[], total_count bigint,
  kpi_avg_ai_first_response double precision, kpi_avg_ai_duration double precision,
  kpi_avg_human_pickup double precision, kpi_avg_human_resolution double precision,
  kpi_avg_total_resolution double precision, kpi_p50_ai_first_response double precision,
  kpi_p90_ai_first_response double precision, kpi_pct_resolved_no_human double precision,
  kpi_avg_csat double precision, kpi_csat_response_rate double precision
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
      COALESCE(
        p.full_name,
        CASE c.ai_mode::text
          WHEN 'autopilot' THEN 'IA (Autopilot)'
          WHEN 'copilot'   THEN 'IA (Copilot)'
          ELSE 'Não atribuído'
        END
      ) AS aname,
      COALESCE(
        d.name,
        (SELECT d2.name FROM chat_flow_states cfs
         JOIN chat_flows cf ON cf.id = cfs.flow_id
         JOIN departments d2 ON d2.id = cf.department_id
         WHERE cfs.conversation_id = c.id
         ORDER BY cfs.started_at DESC LIMIT 1),
        'Sem departamento'
      ) AS dname,
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
    m.conv_id, m.sid, m.ch, m.st, m.cname, m.cphone, m.aname, m.dname,
    m.cfm, m.afm, m.ho_at, m.agfm, m.res_at,
    m.ai_fr_sec, m.ai_dur_sec, m.tth_sec, m.hp_sec, m.hr_sec, m.tr_sec,
    m.csat, COALESCE(m.tgs, ARRAY[]::text[]),
    a.tc, a.avg_ai_fr, a.avg_ai_dur, a.avg_hp, a.avg_hr, a.avg_tr,
    a.p50_ai_fr, a.p90_ai_fr, a.pct_no_human, a.avg_csat, a.csat_rr
  FROM metrics m
  CROSS JOIN agg a
  ORDER BY m.cfm DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
END;
$function$;

-- =============================================
-- RPC 2: get_commercial_conversations_report — fill agent/department fallbacks
-- =============================================
CREATE OR REPLACE FUNCTION public.get_commercial_conversations_report(
  p_start timestamp with time zone,
  p_end timestamp with time zone,
  p_department_id uuid DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_channel text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  short_id text, conversation_id uuid, status text,
  contact_name text, contact_email text, contact_phone text, contact_organization text,
  created_at timestamptz, closed_at timestamptz,
  waiting_time_seconds bigint, duration_seconds bigint,
  assigned_agent_name text, participants text, department_name text,
  interactions_count bigint, origin text,
  csat_score integer, csat_comment text, ticket_id uuid,
  bot_flow text, tags_all text[], last_conversation_tag text,
  first_customer_message text, waiting_after_assignment_seconds bigint,
  total_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    LEFT(c.id::TEXT, 8) AS short_id,
    c.id AS conversation_id,
    c.status::TEXT,
    COALESCE(
      NULLIF(TRIM(COALESCE(co.first_name,'') || ' ' || COALESCE(co.last_name,'')), ''),
      co.phone,
      'Sem nome'
    ) AS contact_name,
    co.email AS contact_email,
    co.phone AS contact_phone,
    org.name AS contact_organization,
    c.created_at,
    c.closed_at,
    wait_calc.waiting_time_seconds,
    CASE WHEN c.closed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (c.closed_at - c.created_at))::BIGINT
      ELSE NULL
    END AS duration_seconds,
    COALESCE(
      p.full_name,
      CASE c.ai_mode::text
        WHEN 'autopilot' THEN 'IA (Autopilot)'
        WHEN 'copilot'   THEN 'IA (Copilot)'
        ELSE 'Não atribuído'
      END
    ) AS assigned_agent_name,
    participants_calc.participants,
    COALESCE(
      d.name,
      (SELECT d2.name FROM chat_flow_states cfs
       JOIN chat_flows cf ON cf.id = cfs.flow_id
       JOIN departments d2 ON d2.id = cf.department_id
       WHERE cfs.conversation_id = c.id
       ORDER BY cfs.started_at DESC LIMIT 1),
      'Sem departamento'
    ) AS department_name,
    msg_count.interactions_count,
    CASE WHEN c.channel::TEXT = 'whatsapp'
      THEN 'WhatsApp (' || COALESCE(c.whatsapp_provider, 'unknown') || ')'
      ELSE c.channel::TEXT
    END AS origin,
    rating_calc.csat_score,
    rating_calc.csat_comment,
    ticket_calc.ticket_id,
    c.ai_mode::TEXT AS bot_flow,
    tags_calc.tags_all,
    tag_calc.last_conversation_tag,
    first_msg.first_customer_message,
    wait_after_assign.waiting_after_assignment_seconds,
    COUNT(*) OVER() AS total_count

  FROM conversations c
  JOIN contacts co ON co.id = c.contact_id
  LEFT JOIN organizations org ON org.id = co.organization_id
  LEFT JOIN profiles p ON p.id = c.assigned_to
  LEFT JOIN departments d ON d.id = c.department

  LEFT JOIN LATERAL (
    SELECT COALESCE(COUNT(*), 0)::BIGINT AS interactions_count
    FROM messages m WHERE m.conversation_id = c.id
  ) msg_count ON true

  LEFT JOIN LATERAL (
    SELECT MIN(created_at) AS first_agent_message_at
    FROM messages m
    WHERE m.conversation_id = c.id 
      AND m.sender_type::text IN ('agent', 'user')
  ) fam ON true

  LEFT JOIN LATERAL (
    SELECT 
      CASE
        WHEN fam.first_agent_message_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (fam.first_agent_message_at - c.created_at))::BIGINT
        WHEN c.first_response_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (c.first_response_at - c.created_at))::BIGINT
        ELSE NULL
      END AS waiting_time_seconds
  ) wait_calc ON true

  LEFT JOIN LATERAL (
    SELECT LEFT(content, 200) AS first_customer_message
    FROM messages m
    WHERE m.conversation_id = c.id AND m.sender_type::text = 'contact'
    ORDER BY m.created_at ASC LIMIT 1
  ) first_msg ON true

  LEFT JOIN LATERAL (
    SELECT t.name AS last_conversation_tag
    FROM conversation_tags ct
    JOIN tags t ON t.id = ct.tag_id
    WHERE ct.conversation_id = c.id AND t.category = 'conversation'
    ORDER BY ct.created_at DESC LIMIT 1
  ) tag_calc ON true

  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT t.name ORDER BY t.name) AS tags_all
    FROM conversation_tags ct
    JOIN tags t ON t.id = ct.tag_id
    WHERE ct.conversation_id = c.id
  ) tags_calc ON true

  LEFT JOIN LATERAL (
    SELECT STRING_AGG(DISTINCT full_name, ', ' ORDER BY full_name) AS participants
    FROM (
      SELECT p2.full_name
      FROM messages m
      JOIN profiles p2 ON p2.id = m.sender_id
      WHERE m.conversation_id = c.id AND m.sender_type::text IN ('agent', 'user')
      UNION
      SELECT p3.full_name
      FROM conversation_assignment_logs al
      JOIN profiles p3 ON p3.id = al.assigned_to
      WHERE al.conversation_id = c.id
    ) u
    WHERE full_name IS NOT NULL AND full_name <> ''
  ) participants_calc ON true

  LEFT JOIN LATERAL (
    SELECT MIN(created_at) AS first_assigned_at
    FROM conversation_assignment_logs al
    WHERE al.conversation_id = c.id
  ) fa ON true

  LEFT JOIN LATERAL (
    SELECT 
      CASE
        WHEN fa.first_assigned_at IS NOT NULL AND fam.first_agent_message_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (fam.first_agent_message_at - fa.first_assigned_at))::BIGINT
        WHEN fa.first_assigned_at IS NOT NULL AND c.first_response_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (c.first_response_at - fa.first_assigned_at))::BIGINT
        ELSE NULL
      END AS waiting_after_assignment_seconds
  ) wait_after_assign ON true

  LEFT JOIN LATERAL (
    SELECT t.id AS ticket_id
    FROM tickets t
    WHERE t.conversation_id = c.id
    ORDER BY t.created_at DESC LIMIT 1
  ) ticket_calc ON true

  LEFT JOIN LATERAL (
    SELECT r.rating AS csat_score, r.feedback_text AS csat_comment
    FROM conversation_ratings r
    WHERE r.conversation_id = c.id
    LIMIT 1
  ) rating_calc ON true

  WHERE c.created_at >= p_start
    AND c.created_at < p_end
    AND (p_department_id IS NULL OR c.department = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_status IS NULL OR c.status::TEXT = p_status)
    AND (p_channel IS NULL OR c.channel::TEXT = p_channel)
    AND (
      p_search IS NULL OR
      co.first_name ILIKE '%' || p_search || '%' OR
      co.last_name  ILIKE '%' || p_search || '%' OR
      co.phone      ILIKE '%' || p_search || '%' OR
      co.email      ILIKE '%' || p_search || '%'
    )
  ORDER BY c.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$;
