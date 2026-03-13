CREATE OR REPLACE FUNCTION public.get_commercial_conversations_report(p_start timestamp with time zone, p_end timestamp with time zone, p_department_id uuid DEFAULT NULL::uuid, p_agent_id uuid DEFAULT NULL::uuid, p_status text DEFAULT NULL::text, p_channel text DEFAULT NULL::text, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(short_id text, conversation_id uuid, status text, contact_name text, contact_email text, contact_phone text, contact_organization text, created_at timestamp with time zone, closed_at timestamp with time zone, waiting_time_seconds bigint, duration_seconds bigint, assigned_agent_name text, participants text, department_name text, interactions_count bigint, origin text, csat_score integer, csat_comment text, ticket_id uuid, bot_flow text, tags_all text[], tags_auto text[], last_conversation_tag text, first_customer_message text, waiting_after_assignment_seconds bigint, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
AS $function$
  SELECT
    LEFT(c.id::text, 8) AS short_id,
    c.id AS conversation_id,
    c.status::text,
    COALESCE(
      NULLIF(TRIM(COALESCE(co.first_name,'') || ' ' || COALESCE(co.last_name,'')), ''),
      co.phone, 'Sem nome'
    ) AS contact_name,
    co.email AS contact_email,
    co.phone AS contact_phone,
    org.name AS contact_organization,
    c.created_at,
    c.closed_at,
    wait_calc.waiting_time_seconds,
    CASE WHEN c.closed_at IS NOT NULL
      THEN EXTRACT(EPOCH FROM (c.closed_at - c.created_at))::bigint
      ELSE NULL
    END AS duration_seconds,
    COALESCE(
      p.full_name,
      CASE c.ai_mode::text
        WHEN 'autopilot' THEN 'IA (Autopilot)'
        WHEN 'copilot'   THEN 'IA (Copilot)'
        ELSE NULL
      END,
      CASE WHEN has_bot.has_bot_msg THEN 'Bot (Fluxo)' ELSE 'Não atribuído' END
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
    CASE WHEN c.channel::text = 'whatsapp'
      THEN 'WhatsApp (' || COALESCE(c.whatsapp_provider, 'unknown') || ')'
      ELSE c.channel::text
    END AS origin,
    rating_calc.csat_score,
    rating_calc.csat_comment,
    ticket_calc.ticket_id,
    c.ai_mode::text AS bot_flow,
    tags_calc.tags_all,
    NULL::text[] AS tags_auto,
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
    SELECT COALESCE(COUNT(*), 0)::bigint AS interactions_count
    FROM messages m WHERE m.conversation_id = c.id
  ) msg_count ON true

  LEFT JOIN LATERAL (
    SELECT MIN(m.created_at) AS first_agent_message_at
    FROM messages m
    WHERE m.conversation_id = c.id
      AND m.sender_type::text IN ('agent', 'user')
      AND m.sender_id IS NOT NULL
  ) fam ON true

  LEFT JOIN LATERAL (
    SELECT EXISTS (
      SELECT 1 FROM messages m
      WHERE m.conversation_id = c.id
        AND m.sender_type::text IN ('agent', 'user')
        AND m.sender_id IS NULL
    ) AS has_bot_msg
  ) has_bot ON true

  LEFT JOIN LATERAL (
    SELECT
      CASE
        WHEN fam.first_agent_message_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (fam.first_agent_message_at - c.created_at))::bigint
        WHEN c.first_response_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (c.first_response_at - c.created_at))::bigint
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
    SELECT
      ARRAY_AGG(DISTINCT t.name ORDER BY t.name) AS tags_all
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
      WHERE m.conversation_id = c.id
        AND m.sender_type::text IN ('agent', 'user')
        AND m.sender_id IS NOT NULL
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
          THEN EXTRACT(EPOCH FROM (fam.first_agent_message_at - fa.first_assigned_at))::bigint
        WHEN fa.first_assigned_at IS NOT NULL AND c.first_response_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (c.first_response_at - fa.first_assigned_at))::bigint
        ELSE NULL
      END AS waiting_after_assignment_seconds
  ) wait_after_assign ON true

  LEFT JOIN LATERAL (
    SELECT t.id AS ticket_id
    FROM tickets t WHERE t.conversation_id = c.id
    ORDER BY t.created_at DESC LIMIT 1
  ) ticket_calc ON true

  LEFT JOIN LATERAL (
    SELECT r.rating AS csat_score, r.feedback_text AS csat_comment
    FROM conversation_ratings r WHERE r.conversation_id = c.id
    LIMIT 1
  ) rating_calc ON true

  WHERE c.created_at >= p_start
    AND c.created_at < p_end
    AND (p_department_id IS NULL OR c.department = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_status IS NULL OR c.status::text = p_status)
    AND (p_channel IS NULL OR c.channel::text = p_channel)
    AND (
      p_search IS NULL OR
      co.first_name ILIKE '%' || p_search || '%' OR
      co.last_name  ILIKE '%' || p_search || '%' OR
      co.phone      ILIKE '%' || p_search || '%' OR
      co.email      ILIKE '%' || p_search || '%'
    )
  ORDER BY c.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$function$