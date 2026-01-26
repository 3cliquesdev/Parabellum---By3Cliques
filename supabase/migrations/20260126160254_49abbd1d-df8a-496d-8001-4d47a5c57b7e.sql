-- Fix: Preserve copilot/disabled conversations when agent goes offline
-- Conversations manually assumed by agents should NOT be returned to autopilot

CREATE OR REPLACE FUNCTION redistribute_on_agent_offline()
RETURNS TRIGGER AS $$
DECLARE
  autopilot_count INTEGER;
  copilot_count INTEGER;
BEGIN
  -- Only trigger when agent manually goes offline
  IF OLD.availability_status = 'online' 
     AND NEW.availability_status != 'online' 
     AND NEW.manual_offline = true
  THEN
    -- 1. Redistribute only autopilot/waiting_human conversations to AI
    -- These were NOT manually assumed by the agent
    UPDATE conversations
    SET 
      assigned_to = NULL,
      previous_agent_id = OLD.id,
      ai_mode = 'autopilot'
    WHERE 
      assigned_to = OLD.id 
      AND status = 'open'
      AND ai_mode IN ('autopilot', 'waiting_human');
    
    GET DIAGNOSTICS autopilot_count = ROW_COUNT;
    
    -- 2. Conversations in 'copilot' or 'disabled' were MANUALLY assumed
    -- Move them to 'waiting_human' (human queue) instead of autopilot
    UPDATE conversations
    SET 
      assigned_to = NULL,
      previous_agent_id = OLD.id,
      ai_mode = 'waiting_human'  -- Keep in human queue, NOT autopilot
    WHERE 
      assigned_to = OLD.id 
      AND status = 'open'
      AND ai_mode IN ('copilot', 'disabled');
    
    GET DIAGNOSTICS copilot_count = ROW_COUNT;
    
    IF autopilot_count > 0 OR copilot_count > 0 THEN
      RAISE NOTICE 'Agent % offline: % to autopilot, % preserved for human queue', 
        OLD.id, autopilot_count, copilot_count;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;