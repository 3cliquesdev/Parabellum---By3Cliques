-- =============================================
-- DROP FUNÇÕES EXISTENTES PARA RECRIAR
-- =============================================
DROP FUNCTION IF EXISTS public.get_commercial_conversations_pivot(TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_commercial_conversations_drilldown(TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, UUID, TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.get_commercial_conversations_report(TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, TEXT, INT, INT);

-- =============================================
-- ÍNDICES DE PERFORMANCE PARA RELATÓRIO COMERCIAL
-- =============================================
CREATE INDEX IF NOT EXISTS idx_conversations_created_dept_status 
ON public.conversations (created_at DESC, department, status);

CREATE INDEX IF NOT EXISTS idx_conversations_assigned_dept 
ON public.conversations (assigned_to, department) 
WHERE assigned_to IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_tags_conv_created_desc 
ON public.conversation_tags (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_tags_category 
ON public.tags (category);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_conv_created 
ON public.conversation_assignment_logs (conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_tickets_conv_created_desc 
ON public.tickets (conversation_id, created_at DESC) 
WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conv_created_sender 
ON public.messages (conversation_id, created_at, sender_type);

-- =============================================
-- RPC 1: PIVOT - Departamento x Categoria
-- =============================================
CREATE FUNCTION public.get_commercial_conversations_pivot(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_department_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL
)
RETURNS TABLE (
  department_id UUID,
  department_name TEXT,
  category TEXT,
  conversation_count BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  WITH latest_conv_tag AS (
    SELECT DISTINCT ON (ct.conversation_id)
      ct.conversation_id,
      t.category
    FROM conversation_tags ct
    JOIN tags t ON t.id = ct.tag_id
    WHERE t.category = 'conversation'
    ORDER BY ct.conversation_id, ct.created_at DESC
  )
  SELECT
    d.id AS department_id,
    d.name AS department_name,
    COALESCE(lct.category, 'sem_tag') AS category,
    COUNT(*)::BIGINT AS conversation_count
  FROM conversations c
  JOIN departments d ON d.id = c.department
  LEFT JOIN latest_conv_tag lct ON lct.conversation_id = c.id
  WHERE c.created_at >= p_start
    AND c.created_at < p_end
    AND (p_department_id IS NULL OR c.department = p_department_id)
    AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
    AND (p_status IS NULL OR c.status::TEXT = p_status)
    AND (p_channel IS NULL OR c.channel::TEXT = p_channel)
  GROUP BY d.id, d.name, COALESCE(lct.category, 'sem_tag')
  ORDER BY d.name, category;
$$;

REVOKE ALL ON FUNCTION public.get_commercial_conversations_pivot(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_commercial_conversations_pivot(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT
) TO authenticated;

-- =============================================
-- RPC 2: DRILLDOWN - Lista paginada para modal
-- =============================================
CREATE FUNCTION public.get_commercial_conversations_drilldown(
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ,
  p_department_id UUID,
  p_category TEXT,
  p_agent_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_channel TEXT DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  conversation_id UUID,
  short_id TEXT,
  contact_name TEXT,
  contact_phone TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  assigned_agent_name TEXT,
  tag_name TEXT,
  total_count BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  WITH latest_conv_tag AS (
    SELECT DISTINCT ON (ct.conversation_id)
      ct.conversation_id,
      t.name AS tag_name,
      t.category
    FROM conversation_tags ct
    JOIN tags t ON t.id = ct.tag_id
    WHERE t.category = 'conversation'
    ORDER BY ct.conversation_id, ct.created_at DESC
  ),
  filtered AS (
    SELECT
      c.id AS conversation_id,
      LEFT(c.id::TEXT, 8) AS short_id,
      COALESCE(
        NULLIF(TRIM(COALESCE(co.first_name,'') || ' ' || COALESCE(co.last_name,'')), ''),
        co.phone,
        'Sem nome'
      ) AS contact_name,
      co.phone AS contact_phone,
      c.status::TEXT,
      c.created_at,
      c.closed_at,
      p.full_name AS assigned_agent_name,
      lct.tag_name
    FROM conversations c
    JOIN contacts co ON co.id = c.contact_id
    LEFT JOIN profiles p ON p.id = c.assigned_to
    LEFT JOIN latest_conv_tag lct ON lct.conversation_id = c.id
    WHERE c.created_at >= p_start
      AND c.created_at < p_end
      AND c.department = p_department_id
      AND (
        (p_category = 'sem_tag' AND lct.conversation_id IS NULL)
        OR (p_category <> 'sem_tag' AND lct.category = p_category)
      )
      AND (p_agent_id IS NULL OR c.assigned_to = p_agent_id)
      AND (p_status IS NULL OR c.status::TEXT = p_status)
      AND (p_channel IS NULL OR c.channel::TEXT = p_channel)
  )
  SELECT
    f.conversation_id,
    f.short_id,
    f.contact_name,
    f.contact_phone,
    f.status,
    f.created_at,
    f.closed_at,
    f.assigned_agent_name,
    f.tag_name,
    COUNT(*) OVER() AS total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

REVOKE ALL ON FUNCTION public.get_commercial_conversations_drilldown(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, UUID, TEXT, TEXT, INT, INT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_commercial_conversations_drilldown(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, UUID, TEXT, TEXT, INT, INT
) TO authenticated;

-- =============================================
-- RPC 3: REPORT - Visão detalhada completa
-- =============================================
CREATE FUNCTION public.get_commercial_conversations_report(
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
  latest_conv_tag AS (
    SELECT DISTINCT ON (ct.conversation_id)
      ct.conversation_id,
      t.name AS tag_name
    FROM conversation_tags ct
    JOIN tags t ON t.id = ct.tag_id
    WHERE t.category = 'conversation'
    ORDER BY ct.conversation_id, ct.created_at DESC
  ),
  all_tags AS (
    SELECT
      ct.conversation_id,
      ARRAY_AGG(DISTINCT t.name ORDER BY t.name) AS tags
    FROM conversation_tags ct
    JOIN tags t ON t.id = ct.tag_id
    GROUP BY ct.conversation_id
  ),
  msg_counts AS (
    SELECT
      conversation_id,
      COUNT(*)::BIGINT AS interactions_count
    FROM messages
    GROUP BY conversation_id
  ),
  first_agent_msg AS (
    SELECT
      conversation_id,
      MIN(created_at) AS first_agent_message_at
    FROM messages
    WHERE sender_type::text IN ('agent', 'user')
    GROUP BY conversation_id
  ),
  first_customer_msg AS (
    SELECT DISTINCT ON (conversation_id)
      conversation_id,
      LEFT(content, 200) AS content
    FROM messages
    WHERE sender_type::text = 'contact'
    ORDER BY conversation_id, created_at ASC
  ),
  first_assignment AS (
    SELECT
      conversation_id,
      MIN(created_at) AS first_assigned_at
    FROM conversation_assignment_logs
    GROUP BY conversation_id
  ),
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
  last_ticket AS (
    SELECT DISTINCT ON (conversation_id)
      conversation_id,
      id AS ticket_id
    FROM tickets
    WHERE conversation_id IS NOT NULL
    ORDER BY conversation_id, created_at DESC
  ),
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
    CASE
      WHEN fam.first_agent_message_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (fam.first_agent_message_at - c.created_at))::BIGINT
      WHEN c.first_response_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (c.first_response_at - c.created_at))::BIGINT
      ELSE NULL
    END AS waiting_time_seconds,
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
    c.ai_mode::TEXT AS bot_flow,
    at.tags AS tags_all,
    lct.tag_name AS last_conversation_tag,
    fcm.content AS first_customer_message,
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

REVOKE ALL ON FUNCTION public.get_commercial_conversations_report(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, TEXT, INT, INT
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_commercial_conversations_report(
  TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, TEXT, TEXT, TEXT, INT, INT
) TO authenticated;