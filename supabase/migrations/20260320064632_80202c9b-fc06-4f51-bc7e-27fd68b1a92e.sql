-- Permitir acesso anônimo (SELECT) à tabela email_branding para a tela de login carregar logo/nome
CREATE POLICY "anon_can_view_email_branding"
ON public.email_branding
FOR SELECT
TO anon
USING (true);