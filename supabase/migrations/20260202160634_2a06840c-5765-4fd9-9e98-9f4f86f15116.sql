-- =====================================================
-- PATCH 1-SHOT: Correção das RPCs do Relatório Comercial
-- 4 correções: interactions_count, participants, waiting_time, bot_flow
-- =====================================================

-- =====================================================
-- RPC 1: get_commercial_conversations_report (corrigida)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_commercial_conversations_report(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_department_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  short_id TEXT,
  conversation_id UUID,
  status TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  contact_organization TEXT,
  created_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  waiting_time_seconds BIGINT,
  duration_seconds BIGINT,
  assigned_agent_name TEXT,
  participants TEXT,
  department_name TEXT,
  interactions_count BIGINT,
  origin TEXT,
  csat_score INT,
  csat_comment TEXT,
  ticket_id UUID,
  bot_flow TEXT,
  tags_all TEXT[],
  last_conversation_tag TEXT,
  first_customer_message TEXT,
  waiting_after_assignment_seconds BIGINT,
  total_count BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  WITH
  -- Última tag da conversa (somente category='conversation')
  latest_conv_tag AS (
    SELECT DISTINCT ON (ct.conversation_id)
      ct.conversation_id,
      t.name AS tag_name
    FROM conversation_tags ct
    JOIN tags t ON t.id = ct.tag_id
    WHERE t.category = 'conversation'
    ORDER BY ct.conversation_id, ct.created_at DESC
  ),

  -- Todas as tags da conversa (qualquer categoria)
  all_tags AS (
    SELECT
      ct.conversation_id,
      ARRAY_AGG(DISTINCT t.name ORDER BY t.name) AS tags
    FROM conversation_tags ct
    JOIN tags t ON t.id = ct.tag_id
    GROUP BY ct.conversation_id
  ),

  -- FIX 1: interactions_count = total de mensagens (todas)
  msg_counts AS (
    SELECT
      conversation_id,
      COUNT(*)::BIGINT AS interactions_count
    FROM messages
    GROUP BY conversation_id
  ),

  -- FIX 3: waiting_time baseado na primeira msg do agente/humano (fallback para first_response_at)
  first_agent_msg AS (
    SELECT
      conversation_id,
      MIN(created_at) AS first_agent_message_at
    FROM messages
    WHERE sender_type::text IN ('agent', 'user')
    GROUP BY conversation_id
  ),

  -- Primeira mensagem do cliente
  first_customer_msg AS (
    SELECT DISTINCT ON (conversation_id)
      conversation_id,
      LEFT(content, 200) AS content
    FROM messages
    WHERE sender_type::text = 'contact'
    ORDER BY conversation_id, created_at ASC
  ),

  -- Primeira atribuição
  first_assignment AS (
    SELECT
      conversation_id,
      MIN(created_at) AS first_assigned_at
    FROM conversation_assignment_logs
    GROUP BY conversation_id
  ),

  -- FIX 2: participants = união (mensagens de agentes + logs de atribuição)
  message_agent_participants AS (
    SELECT
      m.conversation_id,
      p.full_name
    FROM messages m
    JOIN profiles p ON p.id = m.sender_id
    WHERE m.sender_type::text IN ('agent', 'user')
  ),
  assignment_participants AS (
    SELECT
      al.conversation_id,
      p.full_name
    FROM conversation_assignment_logs al
    JOIN profiles p ON p.id = al.assigned_to
  ),
  participants_agg AS (
    SELECT
      conversation_id,
      STRING_AGG(DISTINCT full_name, ', ' ORDER BY full_name) AS participants
    FROM (
      SELECT * FROM message_agent_participants
      UNION ALL
      SELECT * FROM assignment_participants
    ) u
    WHERE full_name IS NOT NULL AND full_name <> ''
    GROUP BY conversation_id
  ),

  -- Último ticket ligado à conversa
  last_ticket AS (
    SELECT DISTINCT ON (conversation_id)
      conversation_id,
      id AS ticket_id
    FROM tickets
    WHERE conversation_id IS NOT NULL
    ORDER BY conversation_id, created_at DESC
  ),

  -- CSAT
  ratings AS (
    SELECT
      conversation_id,
      rating,
      feedback_text
    FROM conversation_ratings
  )

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

    -- waiting_time_seconds
    CASE
      WHEN fam.first_agent_message_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (fam.first_agent_message_at - c.created_at))::BIGINT
      WHEN c.first_response_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (c.first_response_at - c.created_at))::BIGINT
      ELSE NULL
    END AS waiting_time_seconds,

    -- duration_seconds
    CASE
      WHEN c.closed_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (c.closed_at - c.created_at))::BIGINT
      ELSE NULL
    END AS duration_seconds,

    p.full_name AS assigned_agent_name,
    pa.participants,
    d.name AS department_name,

    COALESCE(mc.interactions_count, 0) AS interactions_count,

    CASE
      WHEN c.channel::TEXT = 'whatsapp'
        THEN 'WhatsApp (' || COALESCE(c.whatsapp_provider, 'unknown') || ')'
      ELSE c.channel::TEXT
    END AS origin,

    r.rating AS csat_score,
    r.feedback_text AS csat_comment,
    lt.ticket_id,

    -- FIX 4: "Fluxos/Bots" = ai_mode (mantive nome bot_flow p/ não quebrar UI)
    c.ai_mode::TEXT AS bot_flow,

    at.tags AS tags_all,
    lct.tag_name AS last_conversation_tag,
    fcm.content AS first_customer_message,

    -- waiting_after_assignment_seconds
    CASE
      WHEN fa.first_assigned_at IS NOT NULL AND fam.first_agent_message_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (fam.first_agent_message_at - fa.first_assigned_at))::BIGINT
      WHEN fa.first_assigned_at IS NOT NULL AND c.first_response_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (c.first_response_at - fa.first_assigned_at))::BIGINT
      ELSE NULL
    END AS waiting_after_assignment_seconds,

    COUNT(*) OVER() AS total_count

  FROM conversations c
  JOIN contacts co ON co.id = c.contact_id
  LEFT JOIN organizations org ON org.id = co.organization_id
  LEFT JOIN profiles p ON p.id = c.assigned_to
  LEFT JOIN departments d ON d.id = c.department

  LEFT JOIN latest_conv_tag lct ON lct.conversation_id = c.id
  LEFT JOIN all_tags at ON at.conversation_id = c.id
  LEFT JOIN msg_counts mc ON mc.conversation_id = c.id
  LEFT JOIN first_agent_msg fam ON fam.conversation_id = c.id
  LEFT JOIN participants_agg pa ON pa.conversation_id = c.id
  LEFT JOIN first_customer_msg fcm ON fcm.conversation_id = c.id
  LEFT JOIN first_assignment fa ON fa.conversation_id = c.id
  LEFT JOIN last_ticket lt ON lt.conversation_id = c.id
  LEFT JOIN ratings r ON r.conversation_id = c.id

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
$$;

-- Security
REVOKE ALL ON FUNCTION public.get_commercial_conversations_report(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, TEXT, INT, INT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_commercial_conversations_report(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, TEXT, INT, INT
) TO authenticated;

-- =====================================================
-- RPC 2: get_commercial_conversations_kpis (corrigida)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_commercial_conversations_kpis(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_department_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_conversations BIGINT,
  total_open BIGINT,
  total_closed BIGINT,
  total_without_tag BIGINT,
  avg_csat NUMERIC,
  avg_waiting_seconds NUMERIC,
  avg_duration_seconds NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  WITH
  conv_base AS (
    SELECT
      c.id,
      c.status,
      c.created_at,
      c.closed_at,
      c.first_response_at
    FROM conversations c
    WHERE c.created_at >= p_start
      AND c.created_at < p_end
      AND (p_department_id IS NULL OR c.department = p_department_id)
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_status IS NULL OR c.status::TEXT = p_status)
      AND (p_channel IS NULL OR c.channel::TEXT = p_channel)
  ),
  -- Se tem tag category='conversation'
  conv_has_tag AS (
    SELECT
      cb.id AS conversation_id,
      EXISTS (
        SELECT 1
        FROM conversation_tags ct
        JOIN tags t ON t.id = ct.tag_id
        WHERE ct.conversation_id = cb.id
          AND t.category = 'conversation'
      ) AS has_tag
    FROM conv_base cb
  ),
  -- Primeira mensagem de agente/humano (mesmo critério do relatório completo)
  first_agent_msg AS (
    SELECT
      m.conversation_id,
      MIN(m.created_at) AS first_agent_message_at
    FROM messages m
    WHERE m.sender_type::TEXT IN ('agent', 'user')
    GROUP BY m.conversation_id
  ),
  -- CSAT médio (só conversas dentro do range/filtros)
  csat_data AS (
    SELECT AVG(cr.rating)::NUMERIC AS avg_rating
    FROM conversation_ratings cr
    JOIN conv_base cb ON cb.id = cr.conversation_id
  )
  SELECT
    COUNT(*)::BIGINT AS total_conversations,
    COUNT(*) FILTER (WHERE cb.status::TEXT = 'open')::BIGINT AS total_open,
    COUNT(*) FILTER (WHERE cb.status::TEXT = 'closed')::BIGINT AS total_closed,
    COUNT(*) FILTER (WHERE NOT cht.has_tag)::BIGINT AS total_without_tag,
    (SELECT avg_rating FROM csat_data) AS avg_csat,
    -- tempo de espera = primeira msg agente/humano - created_at (fallback: first_response_at)
    AVG(
      EXTRACT(
        EPOCH FROM (
          COALESCE(fam.first_agent_message_at, cb.first_response_at) - cb.created_at
        )
      )
    ) FILTER (
      WHERE COALESCE(fam.first_agent_message_at, cb.first_response_at) IS NOT NULL
    ) AS avg_waiting_seconds,
    -- duração = closed_at - created_at
    AVG(
      EXTRACT(EPOCH FROM (cb.closed_at - cb.created_at))
    ) FILTER (WHERE cb.closed_at IS NOT NULL) AS avg_duration_seconds
  FROM conv_base cb
  LEFT JOIN conv_has_tag cht ON cht.conversation_id = cb.id
  LEFT JOIN first_agent_msg fam ON fam.conversation_id = cb.id;
$$;

-- Security
REVOKE ALL ON FUNCTION public.get_commercial_conversations_kpis(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_commercial_conversations_kpis(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT
) TO authenticated;