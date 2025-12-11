-- Sincronizar todas as permission_keys entre todos os roles
-- Isso garante que cada role tenha acesso a TODAS as permissões disponíveis no sistema

-- 1. Pegar TODAS as permission_keys únicas de TODOS os roles existentes
WITH all_unique_keys AS (
  SELECT DISTINCT 
    permission_key, 
    permission_label, 
    permission_category 
  FROM public.role_permissions
),
-- 2. Listar todos os roles do sistema
all_roles AS (
  SELECT unnest(ARRAY['admin', 'manager', 'sales_rep', 'consultant', 'support_agent', 
    'support_manager', 'financial_manager', 'cs_manager', 'general_manager']::public.app_role[]) as role
)
-- 3. Inserir para CADA role as keys que estão faltando
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT 
  r.role,
  k.permission_key,
  k.permission_label,
  k.permission_category,
  false as enabled  -- Desabilitado por padrão, admin pode habilitar depois
FROM all_roles r
CROSS JOIN all_unique_keys k
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp 
  WHERE rp.role = r.role AND rp.permission_key = k.permission_key
)
ON CONFLICT DO NOTHING;