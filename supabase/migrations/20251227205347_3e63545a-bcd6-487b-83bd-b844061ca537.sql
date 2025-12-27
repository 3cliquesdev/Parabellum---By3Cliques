-- Adicionar permissão reports.distribution para todos os roles
INSERT INTO role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT 
  role,
  'reports.distribution',
  'Ver relatório de distribuição de clientes',
  'reports',
  CASE 
    WHEN role IN ('admin', 'manager') THEN true 
    ELSE false 
  END
FROM (SELECT DISTINCT role FROM role_permissions) AS roles
ON CONFLICT (role, permission_key) DO NOTHING;