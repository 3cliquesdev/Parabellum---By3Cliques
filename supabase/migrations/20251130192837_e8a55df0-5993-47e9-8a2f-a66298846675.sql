-- Fix CHECK constraint on ai_usage_logs to allow 'autopilot_chat' and 'autopilot' feature types
ALTER TABLE public.ai_usage_logs 
DROP CONSTRAINT IF EXISTS ai_usage_logs_feature_type_check;

ALTER TABLE public.ai_usage_logs 
ADD CONSTRAINT ai_usage_logs_feature_type_check 
CHECK (feature_type = ANY (ARRAY['summary', 'sentiment', 'reply', 'tags', 'autopilot_chat', 'autopilot']));