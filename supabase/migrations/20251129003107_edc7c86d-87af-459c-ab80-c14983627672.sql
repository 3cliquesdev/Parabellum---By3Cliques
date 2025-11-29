-- MIGRATION 2: Expandir tabela tickets para workflow financeiro
ALTER TABLE public.tickets
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES public.departments(id);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_tickets_conversation_id ON public.tickets(conversation_id);
CREATE INDEX IF NOT EXISTS idx_tickets_department_id ON public.tickets(department_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);

-- Atualizar RLS policies para financial_manager
DROP POLICY IF EXISTS "financial_managers_can_view_all_tickets" ON public.tickets;
DROP POLICY IF EXISTS "financial_managers_can_update_tickets" ON public.tickets;

CREATE POLICY "financial_managers_can_view_all_tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'financial_manager'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  (has_role(auth.uid(), 'support_agent'::app_role) AND assigned_to = auth.uid())
);

CREATE POLICY "financial_managers_can_update_tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'financial_manager'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  (has_role(auth.uid(), 'support_agent'::app_role) AND assigned_to = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'financial_manager'::app_role) OR
  has_role(auth.uid(), 'admin'::app_role) OR
  has_role(auth.uid(), 'manager'::app_role) OR
  (has_role(auth.uid(), 'support_agent'::app_role) AND assigned_to = auth.uid())
);

-- Comentários explicativos
COMMENT ON COLUMN public.tickets.attachments IS 'JSONB array of evidence files: [{url, type, name, uploaded_at, uploaded_by}]';
COMMENT ON COLUMN public.tickets.conversation_id IS 'Link to originating conversation for audit trail';
COMMENT ON COLUMN public.tickets.department_id IS 'Current department handling the ticket (Suporte, Financeiro, etc)';
COMMENT ON COLUMN public.tickets.approved_by IS 'Financial manager who approved/rejected the ticket';
COMMENT ON COLUMN public.tickets.rejection_reason IS 'Reason for rejection by financial team';