-- Add ai_auto_training to allowed actions in audit_logs
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check 
CHECK (action = ANY (ARRAY['DELETE'::text, 'UPDATE'::text, 'EXPORT'::text, 'ai_auto_training'::text]));