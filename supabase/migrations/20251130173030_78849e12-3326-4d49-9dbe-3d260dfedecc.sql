CREATE OR REPLACE FUNCTION public.pause_cadence_on_reply()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_enrollment RECORD;
BEGIN
  -- Só processar mensagens do cliente (contato externo)
  IF NEW.sender_type != 'contact' THEN
    RETURN NEW;
  END IF;

  -- Buscar enrollment ativo para este contato
  SELECT ce.* INTO v_enrollment
  FROM cadence_enrollments ce
  WHERE ce.contact_id = (
    SELECT contact_id FROM conversations WHERE id = NEW.conversation_id
  )
  AND ce.status = 'active'
  LIMIT 1;

  IF v_enrollment.id IS NOT NULL THEN
    -- Pausar enrollment
    UPDATE cadence_enrollments
    SET 
      status = 'paused',
      replied_at = NEW.created_at
    WHERE id = v_enrollment.id;

    -- Cancelar tasks pendentes
    UPDATE cadence_tasks
    SET status = 'skipped'
    WHERE enrollment_id = v_enrollment.id
    AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$function$