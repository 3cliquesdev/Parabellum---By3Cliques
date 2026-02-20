
-- =============================================
-- FASE 2A: Popular data_catalog com todas as colunas do schema public
-- FASE 2B: Criar RPC exec_report_sql segura
-- =============================================

-- 2A) Inserir todas as colunas de BASE TABLES do schema public
INSERT INTO public.data_catalog (entity, field_name, field_type, label, category, is_sensitive, allow_filter, allow_group, allow_aggregate)
SELECT
  c.table_name AS entity,
  c.column_name AS field_name,
  CASE
    WHEN c.udt_name = 'uuid' THEN 'uuid'
    WHEN c.udt_name IN ('text','varchar','bpchar') THEN 'text'
    WHEN c.data_type = 'USER-DEFINED' AND c.udt_name NOT IN ('uuid') THEN 'text'
    WHEN c.udt_name IN ('int2','int4','int8','numeric','float4','float8') THEN 'number'
    WHEN c.udt_name IN ('timestamp','timestamptz','date') THEN 'date'
    WHEN c.udt_name = 'bool' THEN 'boolean'
    WHEN c.udt_name IN ('jsonb','json') THEN 'jsonb'
    WHEN c.data_type = 'ARRAY' THEN 'jsonb'
    ELSE 'text'
  END AS field_type,
  initcap(replace(c.column_name, '_', ' ')) AS label,
  'Auto' AS category,
  c.column_name ~* '(email|phone|cpf|cnpj|document|address|ip_address|content|body|message|token|password|secret|mobile|whats|zip|postal)' AS is_sensitive,
  true AS allow_filter,
  NOT (c.udt_name IN ('jsonb','json') OR c.data_type = 'ARRAY') AS allow_group,
  c.udt_name IN ('int2','int4','int8','numeric','float4','float8') AS allow_aggregate
FROM information_schema.columns c
JOIN information_schema.tables t
  ON t.table_schema = c.table_schema
  AND t.table_name = c.table_name
  AND t.table_type = 'BASE TABLE'
WHERE c.table_schema = 'public'
  AND c.table_name NOT IN (
    'data_catalog','semantic_metrics','report_definitions','report_fields',
    'report_metrics','report_filters','report_groupings','dashboards',
    'dashboard_blocks','ai_events'
  )
ON CONFLICT (entity, field_name) DO NOTHING;

-- 2B) Criar RPC exec_report_sql
CREATE OR REPLACE FUNCTION public.exec_report_sql(p_sql text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF length(p_sql) > 20000 THEN
    RAISE EXCEPTION 'SQL exceeds maximum allowed length (20000 chars)';
  END IF;

  IF p_sql ~ E';\\s*\\S' THEN
    RAISE EXCEPTION 'Multi-statement SQL is not allowed';
  END IF;

  IF upper(btrim(p_sql)) !~ '^(SELECT|WITH)' THEN
    RAISE EXCEPTION 'Only SELECT/WITH statements are allowed';
  END IF;

  IF p_sql ~* '\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b' THEN
    RAISE EXCEPTION 'Forbidden SQL keyword detected';
  END IF;

  EXECUTE 'SELECT COALESCE(jsonb_agg(row_to_json(t)), ''[]''::jsonb) FROM (' || btrim(p_sql, '; ') || ') t'
  INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_report_sql(text) TO authenticated;
