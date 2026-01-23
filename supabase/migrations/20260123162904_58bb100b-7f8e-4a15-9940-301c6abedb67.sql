-- Inserir permissão settings.chat_flows para todos os roles existentes
INSERT INTO role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT 
  role,
  'settings.chat_flows',
  'Gerenciar fluxos de chat',
  'settings',
  CASE 
    WHEN role IN ('admin', 'manager', 'general_manager', 'support_manager') THEN true
    ELSE false
  END
FROM (
  SELECT DISTINCT role FROM role_permissions
) roles
ON CONFLICT (role, permission_key) DO NOTHING;