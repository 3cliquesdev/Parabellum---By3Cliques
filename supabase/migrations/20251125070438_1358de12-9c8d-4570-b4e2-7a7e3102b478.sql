-- Create playbook_executions table
CREATE TABLE IF NOT EXISTS public.playbook_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES onboarding_playbooks(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  current_node_id TEXT,
  nodes_executed JSONB DEFAULT '[]'::jsonb,
  errors JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  completion_reason JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create playbook_execution_queue table
CREATE TABLE IF NOT EXISTS public.playbook_execution_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES playbook_executions(id) ON DELETE CASCADE,
  node_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  node_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create playbook_goals table
CREATE TABLE IF NOT EXISTS public.playbook_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id UUID NOT NULL REFERENCES onboarding_playbooks(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL CHECK (goal_type IN ('interaction_detected', 'status_change', 'tag_added', 'journey_step_completed')),
  goal_conditions JSONB DEFAULT '{}'::jsonb,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add playbook_execution_id to interactions table
ALTER TABLE public.interactions 
ADD COLUMN IF NOT EXISTS playbook_execution_id UUID REFERENCES playbook_executions(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_playbook_executions_playbook_id ON playbook_executions(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_contact_id ON playbook_executions(contact_id);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_status ON playbook_executions(status);
CREATE INDEX IF NOT EXISTS idx_playbook_executions_status_running ON playbook_executions(status) WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_playbook_execution_queue_execution_id ON playbook_execution_queue(execution_id);
CREATE INDEX IF NOT EXISTS idx_playbook_execution_queue_status ON playbook_execution_queue(status);
CREATE INDEX IF NOT EXISTS idx_playbook_execution_queue_scheduled_for ON playbook_execution_queue(scheduled_for);

CREATE INDEX IF NOT EXISTS idx_playbook_goals_playbook_id ON playbook_goals(playbook_id);
CREATE INDEX IF NOT EXISTS idx_playbook_goals_contact_id ON playbook_goals(contact_id);

CREATE INDEX IF NOT EXISTS idx_interactions_playbook_execution_id ON interactions(playbook_execution_id);

-- Enable RLS
ALTER TABLE playbook_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_execution_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE playbook_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for playbook_executions
CREATE POLICY "Admin and Manager can view all executions"
  ON playbook_executions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Sales rep can view own executions"
  ON playbook_executions FOR SELECT
  USING (
    has_role(auth.uid(), 'sales_rep'::app_role) 
    AND EXISTS (
      SELECT 1 FROM contacts c 
      WHERE c.id = playbook_executions.contact_id 
      AND c.assigned_to = auth.uid()
    )
  );

-- RLS Policies for playbook_execution_queue
CREATE POLICY "Admin and Manager can view all queue items"
  ON playbook_execution_queue FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- RLS Policies for playbook_goals
CREATE POLICY "Admin and Manager can manage goals"
  ON playbook_goals FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Add trigger for updated_at on playbook_executions
CREATE OR REPLACE FUNCTION update_playbook_executions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_playbook_executions_updated_at ON playbook_executions;
CREATE TRIGGER trigger_update_playbook_executions_updated_at
  BEFORE UPDATE ON playbook_executions
  FOR EACH ROW
  EXECUTE FUNCTION update_playbook_executions_updated_at();
