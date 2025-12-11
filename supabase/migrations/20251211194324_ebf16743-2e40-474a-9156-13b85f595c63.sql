
-- Inserir permission_keys faltantes para todos os roles
-- Usa admin como base pois tem todas as permission_keys
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT 
  r.role,
  base.permission_key,
  base.permission_label,
  base.permission_category,
  false as enabled
FROM 
  (SELECT UNNEST(ARRAY['manager', 'sales_rep', 'consultant', 'support_agent', 
    'support_manager', 'financial_manager', 'cs_manager', 'general_manager']::app_role[]) as role) r
CROSS JOIN 
  (SELECT DISTINCT permission_key, permission_label, permission_category 
   FROM public.role_permissions 
   WHERE role = 'admin') base
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp 
  WHERE rp.role = r.role AND rp.permission_key = base.permission_key
);
