-- FASE 1: Quiz Schema - Add quiz columns to customer_journey_steps
ALTER TABLE customer_journey_steps
  ADD COLUMN quiz_enabled BOOLEAN DEFAULT false,
  ADD COLUMN quiz_question TEXT,
  ADD COLUMN quiz_options JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN quiz_correct_option TEXT,
  ADD COLUMN quiz_passed BOOLEAN DEFAULT false,
  ADD COLUMN quiz_passed_at TIMESTAMPTZ,
  ADD COLUMN quiz_attempts INTEGER DEFAULT 0;

COMMENT ON COLUMN customer_journey_steps.quiz_enabled IS 'Whether this step has a quiz gatekeeper';
COMMENT ON COLUMN customer_journey_steps.quiz_question IS 'The quiz question text';
COMMENT ON COLUMN customer_journey_steps.quiz_options IS 'Array of quiz options: [{"id": "a", "text": "Option A"}, ...]';
COMMENT ON COLUMN customer_journey_steps.quiz_correct_option IS 'ID of the correct option (e.g., "a", "b", "c")';
COMMENT ON COLUMN customer_journey_steps.quiz_passed IS 'Whether the student passed the quiz';
COMMENT ON COLUMN customer_journey_steps.quiz_passed_at IS 'When the student passed the quiz';
COMMENT ON COLUMN customer_journey_steps.quiz_attempts IS 'Number of quiz attempts';