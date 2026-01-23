-- 1. Adicionar 'internal_note' ao enum interaction_type
ALTER TYPE interaction_type ADD VALUE IF NOT EXISTS 'internal_note';

-- 2. Remover políticas antigas conflitantes de ticket_comments
DROP POLICY IF EXISTS "can_comment_on_accessible_tickets" ON public.ticket_comments;
DROP POLICY IF EXISTS "role_based_select_comments" ON public.ticket_comments;

-- 3. Criar política abrangente para INSERT em ticket_comments
CREATE POLICY "team_can_comment_on_tickets" 
ON public.ticket_comments
FOR INSERT
WITH CHECK (
  -- Admins e managers podem comentar em qualquer ticket
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'support_manager') OR
  has_role(auth.uid(), 'financial_manager') OR
  has_role(auth.uid(), 'general_manager') OR
  has_role(auth.uid(), 'cs_manager') OR
  -- Agentes e consultants podem comentar
  has_role(auth.uid(), 'support_agent') OR
  has_role(auth.uid(), 'financial_agent') OR
  has_role(auth.uid(), 'consultant') OR
  -- Ou se é o criador do ticket
  EXISTS (
    SELECT 1 FROM public.tickets t 
    WHERE t.id = ticket_comments.ticket_id 
    AND t.created_by = auth.uid()
  )
);

-- 4. Criar política abrangente para SELECT em ticket_comments
CREATE POLICY "team_can_view_ticket_comments" 
ON public.ticket_comments
FOR SELECT
USING (
  has_role(auth.uid(), 'admin') OR
  has_role(auth.uid(), 'manager') OR
  has_role(auth.uid(), 'support_manager') OR
  has_role(auth.uid(), 'financial_manager') OR
  has_role(auth.uid(), 'general_manager') OR
  has_role(auth.uid(), 'cs_manager') OR
  has_role(auth.uid(), 'consultant') OR
  has_role(auth.uid(), 'support_agent') OR
  has_role(auth.uid(), 'financial_agent') OR
  EXISTS (
    SELECT 1 FROM public.tickets t 
    WHERE t.id = ticket_comments.ticket_id 
    AND (t.assigned_to = auth.uid() OR t.created_by = auth.uid())
  )
);