ALTER TABLE chat_flow_states DROP CONSTRAINT IF EXISTS chat_flow_states_status_check;

ALTER TABLE chat_flow_states ADD CONSTRAINT chat_flow_states_status_check 
  CHECK (status = ANY (ARRAY[
    'active', 'waiting_input', 'in_progress', 
    'completed', 'abandoned', 'transferred', 'cancelled'
  ]));