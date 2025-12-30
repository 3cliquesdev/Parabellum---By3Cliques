-- Reverter sales_rep que NUNCA logaram para role = 'user'
-- Estes são clientes/contatos importados, não funcionários internos
UPDATE user_roles 
SET role = 'user'::app_role
WHERE user_id IN (
  SELECT ur.user_id 
  FROM user_roles ur
  JOIN auth.users au ON au.id = ur.user_id
  WHERE ur.role = 'sales_rep'
  AND au.last_sign_in_at IS NULL
);