-- FASE 2: Add RLS policies for cs_manager role

-- Contacts: cs_manager can view and manage all customers
CREATE POLICY "cs_manager_can_view_all_customers" ON contacts
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cs_manager'::app_role)
);

CREATE POLICY "cs_manager_can_update_customers" ON contacts
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'cs_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'cs_manager'::app_role)
);

-- Tickets: cs_manager can view all tickets
CREATE POLICY "cs_manager_can_view_all_tickets" ON tickets
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cs_manager'::app_role)
);

-- Conversations: cs_manager can view all conversations
CREATE POLICY "cs_manager_can_view_all_conversations" ON conversations
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cs_manager'::app_role)
);

CREATE POLICY "cs_manager_can_update_conversations" ON conversations
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'cs_manager'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'cs_manager'::app_role)
);

-- Deals: cs_manager can view all deals
CREATE POLICY "cs_manager_can_view_all_deals" ON deals
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cs_manager'::app_role)
);

-- Customer Journey Steps: cs_manager can view all
CREATE POLICY "cs_manager_can_view_all_journey_steps" ON customer_journey_steps
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'cs_manager'::app_role)
);