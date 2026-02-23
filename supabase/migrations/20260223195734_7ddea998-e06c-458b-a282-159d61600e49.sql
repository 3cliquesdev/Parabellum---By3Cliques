CREATE OR REPLACE FUNCTION public.get_tickets_export_report(
  p_start timestamp with time zone DEFAULT NULL,
  p_end timestamp with time zone DEFAULT NULL,
  p_department_id uuid DEFAULT NULL,
  p_agent_ids uuid[] DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_search text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
  ticket_number text, subject text, status text, priority text, category text,
  contact_name text, contact_email text, contact_phone text, assigned_to_name text,
  requesting_department_name text, department_name text, operation_name text,
  origin_name text, channel text, created_at timestamp with time zone,
  resolved_at timestamp with time zone, due_date timestamp with time zone,
  first_response_at timestamp with time zone, frt_minutes numeric,
  resolution_minutes numeric, sla_response_time_value numeric,
  sla_response_time_unit text, sla_resolution_time_value numeric,
  sla_resolution_time_unit text, total_count bigint, tags_list text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM tickets t
  WHERE (p_start IS NULL OR t.created_at >= p_start)
    AND (p_end IS NULL OR t.created_at <= p_end)
    AND (p_department_id IS NULL OR t.department_id = p_department_id)
    AND (p_agent_ids IS NULL OR t.assigned_to = ANY(p_agent_ids))
    AND (p_status IS NULL OR t.status::text = p_status)
    AND (p_priority IS NULL OR t.priority::text = p_priority)
    AND (p_search IS NULL OR p_search = '' OR
         t.ticket_number ILIKE '%' || p_search || '%' OR
         t.subject ILIKE '%' || p_search || '%');

  RETURN QUERY
  SELECT
    t.ticket_number, t.subject, t.status::text, t.priority::text, t.category::text,
    COALESCE(c.first_name || ' ' || c.last_name, '') AS contact_name,
    COALESCE(c.email, '') AS contact_email,
    COALESCE(c.phone, '') AS contact_phone,
    COALESCE(p.full_name, '') AS assigned_to_name,
    COALESCE(rd.name, '') AS requesting_department_name,
    COALESCE(d.name, '') AS department_name,
    COALESCE(op.name, '') AS operation_name,
    COALESCE(ori.name, '') AS origin_name,
    t.channel, t.created_at, t.resolved_at, t.due_date, t.first_response_at,
    CASE WHEN t.first_response_at IS NOT NULL AND t.created_at IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (t.first_response_at - t.created_at)) / 60, 1)
      ELSE NULL END AS frt_minutes,
    CASE WHEN t.resolved_at IS NOT NULL AND t.created_at IS NOT NULL
      THEN ROUND(EXTRACT(EPOCH FROM (t.resolved_at - t.created_at)) / 60, 1)
      ELSE NULL END AS resolution_minutes,
    sp.response_time_value::NUMERIC AS sla_response_time_value,
    sp.response_time_unit AS sla_response_time_unit,
    sp.resolution_time_value::NUMERIC AS sla_resolution_time_value,
    sp.resolution_time_unit AS sla_resolution_time_unit,
    v_total AS total_count,
    (SELECT STRING_AGG(tg.name, ', ' ORDER BY tg.name)
     FROM ticket_tags tt JOIN tags tg ON tg.id = tt.tag_id
     WHERE tt.ticket_id = t.id) AS tags_list
  FROM tickets t
  LEFT JOIN contacts c ON c.id = t.customer_id
  LEFT JOIN profiles p ON p.id = t.assigned_to
  LEFT JOIN departments d ON d.id = t.department_id
  LEFT JOIN departments rd ON rd.id = t.requesting_department_id
  LEFT JOIN ticket_operations op ON op.id = t.operation_id
  LEFT JOIN ticket_origins ori ON ori.id = t.origin_id
  LEFT JOIN ticket_categories tc ON tc.name::text = t.category::text
  LEFT JOIN sla_policies sp ON sp.category_id = tc.id
    AND sp.priority = t.priority::text AND sp.is_active = true
  WHERE (p_start IS NULL OR t.created_at >= p_start)
    AND (p_end IS NULL OR t.created_at <= p_end)
    AND (p_department_id IS NULL OR t.department_id = p_department_id)
    AND (p_agent_ids IS NULL OR t.assigned_to = ANY(p_agent_ids))
    AND (p_status IS NULL OR t.status::text = p_status)
    AND (p_priority IS NULL OR t.priority::text = p_priority)
    AND (p_search IS NULL OR p_search = '' OR
         t.ticket_number ILIKE '%' || p_search || '%' OR
         t.subject ILIKE '%' || p_search || '%')
  ORDER BY t.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$function$;