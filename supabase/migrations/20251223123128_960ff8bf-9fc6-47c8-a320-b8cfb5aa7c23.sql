-- Fix: Support agents can view tickets they created (even if assigned to someone else)
-- This is needed because after INSERT, the .select() needs to return the created row

-- First, add created_by column to track who created the ticket (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'tickets' 
    AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.tickets ADD COLUMN created_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Update existing policy to include created_by check
DROP POLICY IF EXISTS "support_agent_can_view_assigned_or_unassigned_tickets" ON public.tickets;

CREATE POLICY "support_agent_can_view_tickets"
ON public.tickets
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'support_agent'::app_role) 
  AND (
    assigned_to = auth.uid() 
    OR assigned_to IS NULL
    OR created_by = auth.uid()
  )
);

-- Also, support_manager should be able to insert tickets
CREATE POLICY "support_manager_can_insert_tickets"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'support_manager'::app_role)
);

-- Support agent can also create tickets
CREATE POLICY "support_agent_can_insert_tickets"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'support_agent'::app_role)
);