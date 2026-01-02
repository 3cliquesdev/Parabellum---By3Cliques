CREATE OR REPLACE FUNCTION public.update_playbook_execution_scores()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_execution_id UUID;
  v_calculated_scores JSONB;
BEGIN
  -- CORRIGIDO: usar session_metadata (nome correto da coluna)
  v_execution_id := (NEW.session_metadata->>'execution_id')::UUID;
  
  IF v_execution_id IS NOT NULL THEN
    v_calculated_scores := COALESCE(NEW.calculated_scores, '{}'::jsonb);
    
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
    
    IF EXISTS (SELECT 1 FROM playbook_executions WHERE id = v_execution_id AND status = 'running') THEN
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
$function$;