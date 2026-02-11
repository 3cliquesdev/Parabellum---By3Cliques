
CREATE OR REPLACE FUNCTION public.get_tickets_export_report(
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end TIMESTAMPTZ DEFAULT NULL,
  p_department_id UUID DEFAULT NULL,
  p_agent_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_priority TEXT DEFAULT NULL,
  p_search TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE(
  ticket_number TEXT,
  subject TEXT,
  status TEXT,
  priority TEXT,
  category TEXT,
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  assigned_to_name TEXT,
  requesting_department_name TEXT,
  department_name TEXT,
  operation_name TEXT,
  origin_name TEXT,
  channel TEXT,
  created_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  first_response_at TIMESTAMPTZ,
  frt_minutes NUMERIC,
  resolution_minutes NUMERIC,
  sla_response_time_value NUMERIC,
  sla_response_time_unit TEXT,
  sla_resolution_time_value NUMERIC,
  sla_resolution_time_unit TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Count total matching rows
  SELECT COUNT(*) INTO v_total
  FROM tickets t
  WHERE (p_start IS NULL OR t.created_at >= p_start)
    AND (p_end IS NULL OR t.created_at <= p_end)
    AND (p_department_id IS NULL OR t.department_id = p_department_id)
    AND (p_agent_id IS NULL OR t.assigned_to = p_agent_id)
    AND (p_status IS NULL OR t.status = p_status)
    AND (p_priority IS NULL OR t.priority = p_priority)
    AND (p_search IS NULL OR p_search = '' OR
         t.ticket_number ILIKE '%' || p_search || '%' OR
         t.subject ILIKE '%' || p_search || '%');

  RETURN QUERY
  SELECT
    t.ticket_number,
    t.subject,
    t.status,
    t.priority,
    t.category,
    COALESCE(c.first_name || ' ' || c.last_name, '') AS contact_name,
    COALESCE(c.email, '') AS contact_email,
    COALESCE(c.phone, '') AS contact_phone,
    COALESCE(p.full_name, '') AS assigned_to_name,
    COALESCE(rd.name, '') AS requesting_department_name,
    COALESCE(d.name, '') AS department_name,
    COALESCE(op.name, '') AS operation_name,
    COALESCE(ori.name, '') AS origin_name,
    t.channel,
    t.created_at,
    t.resolved_at,
    t.due_date,
    t.first_response_at,
    CASE WHEN t.first_response_at IS NOT NULL AND t.created_at IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 60, 1)
      ELSE NULL
    END AS frt_minutes,
    CASE WHEN t.resolved_at IS NOT NULL AND t.created_at IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60, 1)
      ELSE NULL
    END AS resolution_minutes,
    sp.response_time_value::NUMERIC AS sla_response_time_value,
    sp.response_time_unit AS sla_response_time_unit,
    sp.resolution_time_value::NUMERIC AS sla_resolution_time_value,
    sp.resolution_time_unit AS sla_resolution_time_unit,
    v_total AS total_count
  FROM tickets t
  LEFT JOIN contacts c ON c.id = t.customer_id
  LEFT JOIN profiles p ON p.id = t.assigned_to
  LEFT JOIN departments d ON d.id = t.department_id
  LEFT JOIN departments rd ON rd.id = t.requesting_department_id
  LEFT JOIN ticket_operations op ON op.id = t.operation_id
  LEFT JOIN ticket_origins ori ON ori.id = t.origin_id
  LEFT JOIN ticket_categories tc ON tc.name = t.category
  LEFT JOIN sla_policies sp ON sp.category_id = tc.id
    AND sp.priority = t.priority
    AND sp.is_active = true
  WHERE (p_start IS NULL OR t.created_at >= p_start)
    AND (p_end IS NULL OR t.created_at <= p_end)
    AND (p_department_id IS NULL OR t.department_id = p_department_id)
    AND (p_agent_id IS NULL OR t.assigned_to = p_agent_id)
    AND (p_status IS NULL OR t.status = p_status)
    AND (p_priority IS NULL OR t.priority = p_priority)
    AND (p_search IS NULL OR p_search = '' OR
         t.ticket_number ILIKE '%' || p_search || '%' OR
         t.subject ILIKE '%' || p_search || '%')
  ORDER BY t.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
