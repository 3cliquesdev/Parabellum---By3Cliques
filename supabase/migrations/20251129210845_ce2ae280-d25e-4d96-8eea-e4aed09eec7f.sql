-- CORREÇÃO CRÍTICA: Remover política UPDATE permissiva em email_verifications
-- Esta política permitia que qualquer usuário atualizasse qualquer registro de verificação

DROP POLICY IF EXISTS public_can_update_own_verifications ON public.email_verifications;

-- A política service_role_only_access já existe e é suficiente para restringir acesso