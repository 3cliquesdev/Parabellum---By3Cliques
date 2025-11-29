-- FASE 2: Atualizar usuário Flavio para forçar OTP no próximo login
UPDATE auth.users 
SET raw_user_meta_data = raw_user_meta_data || '{"must_change_password": true}'::jsonb
WHERE email = 'flavio.silva@3cliques.net';