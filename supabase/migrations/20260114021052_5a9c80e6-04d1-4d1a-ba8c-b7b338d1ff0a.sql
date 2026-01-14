-- 1. Adicionar trigger de auditoria para role_permissions
CREATE TRIGGER audit_role_permissions_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_table_changes();

-- 2. Criar permissões para o role 'user' (copiando do admin, inicialmente desabilitadas)
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
SELECT 
  'user',
  permission_key,
  permission_label,
  permission_category,
  false
FROM public.role_permissions
WHERE role = 'admin'
ON CONFLICT (role, permission_key) DO NOTHING;