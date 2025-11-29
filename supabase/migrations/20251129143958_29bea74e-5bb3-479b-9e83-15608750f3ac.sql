-- Forçar validação OTP para todos os usuários exceto admin principal
UPDATE auth.users 
SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"must_change_password": true}'::jsonb
WHERE email != 'ronildo@liberty.com'
  AND raw_user_meta_data->>'must_change_password' IS DISTINCT FROM 'true';