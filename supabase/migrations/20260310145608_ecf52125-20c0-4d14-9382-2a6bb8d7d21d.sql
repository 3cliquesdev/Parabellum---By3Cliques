-- Drop existing AFTER triggers and recreate as BEFORE
DROP TRIGGER IF EXISTS trg_dispatch_on_conversation_insert ON public.conversations;
DROP TRIGGER IF EXISTS trg_dispatch_on_conversation_update ON public.conversations;

CREATE OR REPLACE FUNCTION public.ensure_dispatch_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.department IS NULL AND NEW.status = 'open' THEN
    NEW.department := '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';
  END IF;

  IF NEW.ai_mode IN ('waiting_human', 'copilot')
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

  IF NEW.assigned_to IS NOT NULL THEN
    UPDATE public.conversation_dispatch_jobs
    SET status = 'completed', updated_at = now()
    WHERE conversation_id = NEW.id
      AND status <> 'completed';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_dispatch_on_conversation_insert
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION ensure_dispatch_job();

CREATE TRIGGER trg_dispatch_on_conversation_update
  BEFORE UPDATE OF ai_mode, assigned_to, department, status ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION ensure_dispatch_job();