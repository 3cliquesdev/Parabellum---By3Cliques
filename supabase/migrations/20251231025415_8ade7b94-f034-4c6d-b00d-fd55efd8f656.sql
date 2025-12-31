-- Add super_admin.access permission for admin role only
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
VALUES ('admin', 'super_admin.access', 'Acessar Painel Super Admin', 'Sistema', true)
ON CONFLICT (role, permission_key) DO NOTHING;