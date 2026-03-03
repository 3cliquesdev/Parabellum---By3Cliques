
-- Limpar consultant_id de contatos onde o usuário atribuído NÃO tem role 'consultant'
UPDATE public.contacts
SET consultant_id = NULL
WHERE consultant_id IS NOT NULL
  AND consultant_id NOT IN (
    SELECT user_id FROM public.user_roles WHERE role = 'consultant'
  );
