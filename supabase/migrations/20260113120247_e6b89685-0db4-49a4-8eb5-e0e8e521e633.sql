-- Criar função SECURITY DEFINER para retornar IDs de contatos de um consultor
-- Isso bypassa RLS da tabela contacts, resolvendo o problema de nested RLS
CREATE OR REPLACE FUNCTION get_consultant_contact_ids(consultant_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM public.contacts WHERE consultant_id = consultant_user_id;
$$;

-- Remover policy antiga que usava subquery problemática
DROP POLICY IF EXISTS "consultant_can_view_tickets" ON tickets;

-- Criar nova policy usando a função SECURITY DEFINER
CREATE POLICY "consultant_can_view_tickets" ON tickets
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'consultant'::app_role) AND (
      customer_id IN (SELECT get_consultant_contact_ids(auth.uid()))
      OR created_by = auth.uid()
    )
  );