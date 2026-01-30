-- ============================================
-- D0: Trigger Refinado para Dispatch
-- Correções: INSERT + UPDATE OF, status='open' apenas, reativa jobs completed
-- ============================================

-- Função robusta que verifica ESTADO ATUAL
CREATE OR REPLACE FUNCTION public.ensure_dispatch_job()
RETURNS TRIGGER AS $$
BEGIN
  -- Se conversa elegível para distribuição, garante job pendente
  IF NEW.ai_mode = 'waiting_human'
     AND NEW.assigned_to IS NULL
     AND NEW.department IS NOT NULL
     AND NEW.status = 'open'  -- Só 'open' é válido no enum
  THEN
    INSERT INTO public.conversation_dispatch_jobs (conversation_id, department_id, priority)
    VALUES (NEW.id, NEW.department, 1)
    ON CONFLICT (conversation_id)
    DO UPDATE SET
      department_id   = EXCLUDED.department_id,
      status          = CASE 
        WHEN conversation_dispatch_jobs.status = 'completed' 
        THEN 'pending'  -- Reativa job se foi completo mas voltou a precisar
        ELSE 'pending'
      END,
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover triggers antigos
DROP TRIGGER IF EXISTS trg_dispatch_on_conversation_insert ON public.conversations;
DROP TRIGGER IF EXISTS trg_dispatch_on_conversation_update ON public.conversations;
DROP TRIGGER IF EXISTS trigger_conversation_dispatch ON public.conversations;

-- INSERT: sempre verifica (conversas que já nascem em waiting_human)
CREATE TRIGGER trg_dispatch_on_conversation_insert
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_dispatch_job();

-- UPDATE: só dispara quando campos relevantes mudam (melhor performance)
CREATE TRIGGER trg_dispatch_on_conversation_update
  AFTER UPDATE OF ai_mode, assigned_to, department, status ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_dispatch_job();