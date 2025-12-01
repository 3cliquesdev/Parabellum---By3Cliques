-- Trigger para Aprendizado Passivo: extrair conhecimento de conversas bem-sucedidas
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
    
    -- Chamar Edge Function de forma assíncrona (via pg_net ou criar job)
    -- Por limitação do Postgres, vamos apenas criar uma entrada na fila
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
        'channel', NEW.channel
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

-- Criar trigger na tabela conversation_ratings
DROP TRIGGER IF EXISTS on_excellent_rating_passive_learning ON conversation_ratings;
CREATE TRIGGER on_excellent_rating_passive_learning
  AFTER INSERT ON conversation_ratings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_passive_learning();

COMMENT ON FUNCTION trigger_passive_learning IS 'Trigger aprendizado passivo quando rating = 5 estrelas';