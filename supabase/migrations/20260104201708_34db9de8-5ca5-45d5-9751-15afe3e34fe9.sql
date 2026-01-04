-- Remove old constraint and add new one with all step types
ALTER TABLE cadence_steps 
DROP CONSTRAINT IF EXISTS cadence_steps_step_type_check;

ALTER TABLE cadence_steps 
ADD CONSTRAINT cadence_steps_step_type_check 
CHECK (step_type IN ('email', 'whatsapp', 'call', 'linkedin', 'task', 'delay', 'sms', 'condition'));