-- Permissão específica para Detecção de Fraude
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT 
  r::app_role, 
  'reports.fraud_detection', 
  'Detecção de Fraude', 
  'reports',
  r IN ('admin', 'manager', 'general_manager', 'financial_manager')
FROM unnest(ARRAY[
  'admin', 'manager', 'general_manager', 'sales_rep', 'consultant', 
  'support_agent', 'support_manager', 'financial_manager', 'cs_manager', 'financial_agent'
]) AS r
ON CONFLICT (role, permission_key) DO NOTHING;

-- Permissão específica para Exportar para NF
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT 
  r::app_role, 
  'reports.fiscal_export', 
  'Exportar para Nota Fiscal', 
  'reports',
  r IN ('admin', 'manager', 'general_manager', 'financial_manager')
FROM unnest(ARRAY[
  'admin', 'manager', 'general_manager', 'sales_rep', 'consultant', 
  'support_agent', 'support_manager', 'financial_manager', 'cs_manager', 'financial_agent'
]) AS r
ON CONFLICT (role, permission_key) DO NOTHING;