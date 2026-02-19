CREATE OR REPLACE FUNCTION public.trigger_passive_learning()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conversation_id UUID;
BEGIN
  -- Apenas processar ratings 5 estrelas (atendimentos excelentes)
  IF NEW.rating = 5 THEN
    v_conversation_id := NEW.conversation_id;
    
    INSERT INTO public.notifications (
      user_id, 
      type, 
      title, 
      message, 
      metadata,
      read
    )
    SELECT 
      ur.user_id,
      'passive_learning_pending',
      '🤖 Nova oportunidade de aprendizado',
      'Conversa com rating 5★ disponível para extração de conhecimento',
      jsonb_build_object(
        'conversation_id', v_conversation_id,
        'rating_id', NEW.id,
        'channel', NEW.channel,
        'action_url', '/settings/ai-audit'
      ),
      false
    FROM user_roles ur
    WHERE ur.role IN ('admin', 'manager', 'support_manager');
    
    PERFORM pg_notify(
      'passive_learning',
      json_build_object(
        'conversation_id', v_conversation_id,
        'rating_id', NEW.id
      )::text
    );
    
    RAISE NOTICE 'Passive learning triggered for conversation %', v_conversation_id;
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_passive_learning IS 'Trigger aprendizado passivo quando rating = 5 estrelas - inclui action_url no metadata';