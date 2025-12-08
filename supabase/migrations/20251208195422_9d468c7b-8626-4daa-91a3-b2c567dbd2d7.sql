-- Inserir permissões da categoria "cadastros" para todos os roles existentes
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT role, 'cadastros.view_consultants', 'Visualizar Consultores', 'cadastros', 
  CASE WHEN role IN ('admin', 'general_manager', 'cs_manager') THEN true ELSE false END
FROM (SELECT DISTINCT role FROM public.role_permissions) AS roles
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT role, 'cadastros.manage_consultants', 'Gerenciar Consultores', 'cadastros',
  CASE WHEN role IN ('admin', 'general_manager', 'cs_manager') THEN true ELSE false END
FROM (SELECT DISTINCT role FROM public.role_permissions) AS roles
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT role, 'cadastros.view_tags', 'Visualizar Tags', 'cadastros',
  CASE WHEN role IN ('admin', 'general_manager') THEN true ELSE false END
FROM (SELECT DISTINCT role FROM public.role_permissions) AS roles
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT role, 'cadastros.manage_tags', 'Criar/Editar/Deletar Tags', 'cadastros',
  CASE WHEN role IN ('admin', 'general_manager') THEN true ELSE false END
FROM (SELECT DISTINCT role FROM public.role_permissions) AS roles
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT role, 'cadastros.view_products', 'Visualizar Produtos', 'cadastros',
  CASE WHEN role IN ('admin', 'general_manager') THEN true ELSE false END
FROM (SELECT DISTINCT role FROM public.role_permissions) AS roles
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT role, 'cadastros.manage_products', 'Gerenciar Produtos', 'cadastros',
  CASE WHEN role IN ('admin', 'general_manager') THEN true ELSE false END
FROM (SELECT DISTINCT role FROM public.role_permissions) AS roles
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT role, 'cadastros.view_departments', 'Visualizar Departamentos', 'cadastros',
  CASE WHEN role IN ('admin', 'general_manager') THEN true ELSE false END
FROM (SELECT DISTINCT role FROM public.role_permissions) AS roles
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT role, 'cadastros.manage_departments', 'Gerenciar Departamentos', 'cadastros',
  CASE WHEN role IN ('admin', 'general_manager') THEN true ELSE false END
FROM (SELECT DISTINCT role FROM public.role_permissions) AS roles
ON CONFLICT DO NOTHING;