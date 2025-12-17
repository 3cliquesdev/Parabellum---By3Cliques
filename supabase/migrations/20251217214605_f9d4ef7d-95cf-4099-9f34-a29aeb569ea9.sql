-- Add execution_context column to playbook_executions for storing form scores and other runtime data
ALTER TABLE playbook_executions 
ADD COLUMN IF NOT EXISTS execution_context JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN playbook_executions.execution_context IS 'Stores runtime context data including form_scores from form submissions';

-- Create index for efficient querying on execution_context
CREATE INDEX IF NOT EXISTS idx_playbook_executions_context ON playbook_executions USING GIN (execution_context);

-- Create function to update execution context with form scores after form submission
CREATE OR REPLACE FUNCTION update_playbook_execution_scores()
RETURNS TRIGGER AS $$
DECLARE
  v_execution_id UUID;
  v_calculated_scores JSONB;
BEGIN
  -- Check if this submission has an execution_id in metadata
  v_execution_id := (NEW.metadata->>'execution_id')::UUID;
  
  IF v_execution_id IS NOT NULL THEN
    -- Get calculated scores from the submission
    v_calculated_scores := COALESCE(NEW.calculated_scores, '{}'::jsonb);
    
    -- Update the playbook execution with the scores
    UPDATE playbook_executions
    SET 
      execution_context = jsonb_set(
        COALESCE(execution_context, '{}'::jsonb),
        '{form_scores}',
        v_calculated_scores,
        true
      ),
      status = CASE 
        WHEN status = 'waiting_form' THEN 'running' 
        ELSE status 
      END,
      updated_at = NOW()
    WHERE id = v_execution_id;
    
    -- Queue the next node if execution was waiting
    -- The process-playbook-queue will pick this up on next run
    IF EXISTS (SELECT 1 FROM playbook_executions WHERE id = v_execution_id AND status = 'running') THEN
      -- Find the form node and queue the next one
      INSERT INTO playbook_execution_queue (
        execution_id,
        node_id,
        node_type,
        node_data,
        scheduled_for,
        status,
        retry_count,
        max_retries
      )
      SELECT 
        v_execution_id,
        'form_completed_' || v_execution_id,
        'form_completed',
        jsonb_build_object('form_submission_id', NEW.id, 'calculated_scores', v_calculated_scores),
        NOW(),
        'pending',
        0,
        3
      WHERE NOT EXISTS (
        SELECT 1 FROM playbook_execution_queue 
        WHERE execution_id = v_execution_id 
        AND node_type = 'form_completed' 
        AND status = 'pending'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on form_submissions to update playbook execution
DROP TRIGGER IF EXISTS trigger_update_playbook_scores ON form_submissions;
CREATE TRIGGER trigger_update_playbook_scores
  AFTER INSERT ON form_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_playbook_execution_scores();