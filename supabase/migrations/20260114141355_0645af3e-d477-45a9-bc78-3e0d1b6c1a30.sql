-- Fix RLS policies to allow support_agent and consultant to transfer conversations

-- 1. Drop and recreate policy for support_agent
DROP POLICY IF EXISTS support_agent_can_update_assigned_conversations ON conversations;
CREATE POLICY support_agent_can_update_assigned_conversations ON conversations
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'support_agent') AND assigned_to = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'support_agent')
  );

-- 2. Drop and recreate policy for consultant
DROP POLICY IF EXISTS consultant_can_update_assigned_conversations ON conversations;
CREATE POLICY consultant_can_update_assigned_conversations ON conversations
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'consultant') AND assigned_to = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'consultant')
  );