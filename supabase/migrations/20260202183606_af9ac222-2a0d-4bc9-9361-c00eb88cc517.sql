-- Otimização da RPC get_commercial_conversations_report com LATERAL JOINs
-- Resolve timeout causado por CTEs materializadas antes do filtro

-- Índice básico para conversation_ratings (sem filtro condicional)
CREATE INDEX IF NOT EXISTS idx_conversation_ratings_conv 
ON conversation_ratings(conversation_id);

-- Índice composto para messages por conversation_id (já existe idx_messages_conversation_id)
-- Vamos criar um índice adicional com created_at para ordenação
CREATE INDEX IF NOT EXISTS idx_messages_conv_created
ON messages(conversation_id, created_at);

-- Recriar RPC otimizada com LATERAL JOINs
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
SET search_path = public
AS $$
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
    p.full_name AS assigned_agent_name,
    participants_calc.participants,
    d.name AS department_name,
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

  -- LATERAL: Contagem de mensagens (só para esta conversa)
  LEFT JOIN LATERAL (
    SELECT COALESCE(COUNT(*), 0)::BIGINT AS interactions_count
    FROM messages m WHERE m.conversation_id = c.id
  ) msg_count ON true

  -- LATERAL: Primeira mensagem do agente
  LEFT JOIN LATERAL (
    SELECT MIN(created_at) AS first_agent_message_at
    FROM messages m
    WHERE m.conversation_id = c.id 
      AND m.sender_type::text IN ('agent', 'user')
  ) fam ON true

  -- LATERAL: Cálculo tempo espera
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

  -- LATERAL: Primeira mensagem do cliente
  LEFT JOIN LATERAL (
    SELECT LEFT(content, 200) AS first_customer_message
    FROM messages m
    WHERE m.conversation_id = c.id AND m.sender_type::text = 'contact'
    ORDER BY m.created_at ASC LIMIT 1
  ) first_msg ON true

  -- LATERAL: Última tag de conversation
  LEFT JOIN LATERAL (
    SELECT t.name AS last_conversation_tag
    FROM conversation_tags ct
    JOIN tags t ON t.id = ct.tag_id
    WHERE ct.conversation_id = c.id AND t.category = 'conversation'
    ORDER BY ct.created_at DESC LIMIT 1
  ) tag_calc ON true

  -- LATERAL: Todas as tags
  LEFT JOIN LATERAL (
    SELECT ARRAY_AGG(DISTINCT t.name ORDER BY t.name) AS tags_all
    FROM conversation_tags ct
    JOIN tags t ON t.id = ct.tag_id
    WHERE ct.conversation_id = c.id
  ) tags_calc ON true

  -- LATERAL: Participantes
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

  -- LATERAL: Primeiro assignment
  LEFT JOIN LATERAL (
    SELECT MIN(created_at) AS first_assigned_at
    FROM conversation_assignment_logs al
    WHERE al.conversation_id = c.id
  ) fa ON true

  -- LATERAL: Tempo após assignment
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

  -- LATERAL: Último ticket
  LEFT JOIN LATERAL (
    SELECT t.id AS ticket_id
    FROM tickets t
    WHERE t.conversation_id = c.id
    ORDER BY t.created_at DESC LIMIT 1
  ) ticket_calc ON true

  -- LATERAL: Rating
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
$$;

-- Revogar acesso público e garantir apenas authenticated
REVOKE ALL ON FUNCTION public.get_commercial_conversations_report FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_commercial_conversations_report TO authenticated;