
CREATE OR REPLACE FUNCTION public.ensure_dispatch_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- FALLBACK: Se conversa está em waiting_human sem departamento, atribuir Suporte
  IF NEW.ai_mode = 'waiting_human'
     AND NEW.assigned_to IS NULL
     AND NEW.department IS NULL
     AND NEW.status = 'open'
  THEN
    NEW.department := '36ce66cd-7414-4fc8-bd4a-268fecc3f01a'; -- Suporte (fallback)
    RAISE LOG '[ensure_dispatch_job] Fallback: assigned Suporte dept to conversation %', NEW.id;
  END IF;

  -- Se conversa elegível para distribuição, garante job pendente
  IF NEW.ai_mode = 'waiting_human'
     AND NEW.assigned_to IS NULL
     AND NEW.department IS NOT NULL
     AND NEW.status = 'open'
  THEN
    INSERT INTO public.conversation_dispatch_jobs (conversation_id, department_id, priority)
    VALUES (NEW.id, NEW.department, 1)
    ON CONFLICT (conversation_id)
    DO UPDATE SET
      department_id   = EXCLUDED.department_id,
      status          = 'pending',
      next_attempt_at = now(),
      updated_at      = now();
  END IF;

  -- Se atribuiu agente, encerra job
  IF NEW.assigned_to IS NOT NULL THEN
    UPDATE public.conversation_dispatch_jobs
    SET status = 'completed', updated_at = now()
    WHERE conversation_id = NEW.id
      AND status <> 'completed';
  END IF;

  RETURN NEW;
END;
$$;
