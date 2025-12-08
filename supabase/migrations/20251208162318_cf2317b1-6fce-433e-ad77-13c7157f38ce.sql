-- Add origin tracking columns to playbook_executions
ALTER TABLE public.playbook_executions 
ADD COLUMN IF NOT EXISTS triggered_by TEXT DEFAULT 'automatic' CHECK (triggered_by IN ('manual', 'automatic', 'bulk')),
ADD COLUMN IF NOT EXISTS triggered_by_user_id UUID REFERENCES public.profiles(id);

-- Add index for filtering by trigger type
CREATE INDEX IF NOT EXISTS idx_playbook_executions_triggered_by ON public.playbook_executions(triggered_by);

-- Add RLS policies for cs_manager to view and manage playbook executions
CREATE POLICY "cs_manager_can_view_all_playbook_executions"
ON public.playbook_executions
FOR SELECT
USING (has_role(auth.uid(), 'cs_manager'::app_role));

CREATE POLICY "cs_manager_can_update_playbook_executions"
ON public.playbook_executions
FOR UPDATE
USING (has_role(auth.uid(), 'cs_manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'cs_manager'::app_role));

-- Add RLS policies for cs_manager on playbook_execution_queue
CREATE POLICY "cs_manager_can_view_execution_queue"
ON public.playbook_execution_queue
FOR SELECT
USING (has_role(auth.uid(), 'cs_manager'::app_role));

-- Comment for documentation
COMMENT ON COLUMN public.playbook_executions.triggered_by IS 'Origin of execution: automatic (Kiwify webhook), manual (single trigger), bulk (mass trigger)';
COMMENT ON COLUMN public.playbook_executions.triggered_by_user_id IS 'User who triggered the execution (for manual/bulk triggers)';