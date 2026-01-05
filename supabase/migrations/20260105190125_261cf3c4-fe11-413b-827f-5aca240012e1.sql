-- Criar função para buscar ticket por ID parcial (resolve problema de ILIKE em UUID)
CREATE OR REPLACE FUNCTION public.find_ticket_by_partial_id(partial_id text)
RETURNS TABLE (
  id uuid, 
  subject text, 
  channel text, 
  customer_id uuid, 
  assigned_to uuid, 
  status text,
  last_email_message_id text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id, 
    t.subject, 
    t.channel::text, 
    t.customer_id, 
    t.assigned_to, 
    t.status::text,
    t.last_email_message_id
  FROM tickets t
  WHERE t.id::text ILIKE partial_id || '%'
  LIMIT 1;
$$;

-- Atualizar policy para permitir support_agent atualizar tickets não atribuídos ou criados por ele
DROP POLICY IF EXISTS "support_agent_can_update_assigned_tickets" ON tickets;

CREATE POLICY "support_agent_can_update_tickets" ON tickets
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role) AND (
    assigned_to = auth.uid() OR 
    assigned_to IS NULL OR
    created_by = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'support_agent'::app_role) AND (
    assigned_to = auth.uid() OR 
    assigned_to IS NULL OR
    created_by = auth.uid()
  )
);