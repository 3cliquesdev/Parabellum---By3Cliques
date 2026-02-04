BEGIN;

-- =============================================
-- PARTE 1: FECHAR BRECHAS DE SEGURANCA
-- =============================================

-- 1) role 'user' nunca pode transferir conversa/ticket ou gerenciar usuarios
UPDATE public.role_permissions
SET enabled = false, updated_at = now()
WHERE role = 'user'
  AND permission_key IN ('inbox.transfer', 'tickets.assign', 'users.manage');

-- 2) Corrigir GRANT perigoso em transfer_conversation_secure (todas as overloads)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS proc
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'transfer_conversation_secure'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC;', r.proc);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated;', r.proc);
  END LOOP;
END$$;

-- =============================================
-- PARTE 2: RPCs DE AUDITORIA (EVITAR N+1)
-- =============================================

-- RPC A: Busca usuarios com roles agregadas
CREATE OR REPLACE FUNCTION public.audit_search_users(
  p_search_term TEXT DEFAULT NULL
)
RETURNS TABLE(
  user_id UUID,
  full_name TEXT,
  email TEXT,
  roles TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS user_id,
    p.full_name,
    u.email,
    COALESCE(ARRAY_AGG(ur.role::TEXT ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
  FROM profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  LEFT JOIN user_roles ur ON ur.user_id = p.id
  WHERE 
    p_search_term IS NULL
    OR p.full_name ILIKE '%' || p_search_term || '%'
    OR u.email ILIKE '%' || p_search_term || '%'
    OR p.id::TEXT = p_search_term
  GROUP BY p.id, p.full_name, u.email
  ORDER BY p.full_name NULLS LAST
  LIMIT 50;
END;
$$;

-- RPC B: Permissoes efetivas de um usuario
CREATE OR REPLACE FUNCTION public.audit_user_effective_permissions(
  p_user_id UUID
)
RETURNS TABLE(
  permission_key TEXT,
  allowed BOOLEAN,
  granted_by_roles TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rp.permission_key::TEXT,
    BOOL_OR(rp.enabled) AS allowed,
    ARRAY_AGG(DISTINCT rp.role::TEXT) FILTER (WHERE rp.enabled) AS granted_by_roles
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role::TEXT = ur.role::TEXT
  WHERE ur.user_id = p_user_id
  GROUP BY rp.permission_key
  ORDER BY rp.permission_key;
END;
$$;

-- RPC C: Security checks (RLS + Security Definer + Grants)
CREATE OR REPLACE FUNCTION public.audit_security_checks()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tables JSONB;
  v_rpcs JSONB;
BEGIN
  -- Verificar RLS nas tabelas criticas
  SELECT jsonb_agg(jsonb_build_object(
    'table_name', c.relname,
    'rls_enabled', c.relrowsecurity,
    'rls_forced', c.relforcerowsecurity
  ))
  INTO v_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname IN ('tickets', 'conversations', 'contacts', 'profiles', 'user_roles', 'role_permissions');

  -- Verificar RPCs criticas
  SELECT jsonb_agg(jsonb_build_object(
    'function_name', p.proname,
    'security_definer', p.prosecdef,
    'owner', pg_get_userbyid(p.proowner),
    'signature', p.oid::regprocedure::TEXT
  ))
  INTO v_rpcs
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN ('transfer_ticket_secure', 'transfer_conversation_secure', 'take_control_secure');

  RETURN jsonb_build_object(
    'tables', COALESCE(v_tables, '[]'::jsonb),
    'rpcs', COALESCE(v_rpcs, '[]'::jsonb),
    'checked_at', now()
  );
END;
$$;

-- Conceder permissoes para as RPCs de auditoria (apenas authenticated)
GRANT EXECUTE ON FUNCTION public.audit_search_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_user_effective_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_security_checks() TO authenticated;

COMMIT;