-- ============================================================
-- HOTFIX FINAL: Trigger BEFORE + Correção de Orphans Dinâmica
-- Data: 2026-03-10
-- Seguro para rodar em produção — não usa UUIDs hardcoded
-- ============================================================

-- ===========================================================
-- PARTE 1: RECRIAR TRIGGER COMO BEFORE
-- Corrige: dispatch não funcionava pois AFTER não modifica NEW
-- ===========================================================

-- Dropar triggers antigos (AFTER)
DROP TRIGGER IF EXISTS trg_dispatch_on_conversation_insert ON public.conversations;
DROP TRIGGER IF EXISTS trg_dispatch_on_conversation_update ON public.conversations;
DROP TRIGGER IF EXISTS trigger_conversation_dispatch ON public.conversations;

-- Reescrever função com lógica corrigida
CREATE OR REPLACE FUNCTION public.ensure_dispatch_job()
RETURNS TRIGGER AS $$
DECLARE
  v_suporte_dept_id UUID;
BEGIN
  -- LÓGICA 1: Atribuir dept Suporte quando NULL (só funciona em BEFORE)
  IF NEW.department IS NULL AND NEW.status = 'open' THEN
    SELECT id INTO v_suporte_dept_id
    FROM public.departments
    WHERE name ILIKE '%suporte%' AND is_active = true
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_suporte_dept_id IS NOT NULL THEN
      NEW.department := v_suporte_dept_id;
      RAISE LOG '[ensure_dispatch_job] Atribuindo dept Suporte (%) à conversa % (ai_mode=%)',
        v_suporte_dept_id, NEW.id, NEW.ai_mode;
    END IF;
  END IF;

  -- LÓGICA 2: Criar/reativar dispatch job
  -- Cobre waiting_human E copilot (fix BUG 2)
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

    RAISE LOG '[ensure_dispatch_job] Job criado/reativado conv=% dept=% mode=%',
      NEW.id, NEW.department, NEW.ai_mode;
  END IF;

  -- LÓGICA 3: Encerrar dispatch job se agente atribuído
  IF NEW.assigned_to IS NOT NULL THEN
    UPDATE public.conversation_dispatch_jobs
    SET status = 'completed', updated_at = now()
    WHERE conversation_id = NEW.id
      AND status <> 'completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recriar como BEFORE triggers
CREATE TRIGGER trg_dispatch_on_conversation_insert
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_dispatch_job();

CREATE TRIGGER trg_dispatch_on_conversation_update
  BEFORE UPDATE OF ai_mode, assigned_to, department, status ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_dispatch_job();

-- ✅ Trigger BEFORE criado

-- ===========================================================
-- PARTE 2: CORRIGIR ORPHANS ATUAIS (dinâmico, sem UUIDs fixos)
-- ===========================================================

DO $$
DECLARE
  v_suporte UUID;
  v_updated INT;
  v_jobs INT;
BEGIN
  -- Buscar dept Suporte dinamicamente
  SELECT id INTO v_suporte
  FROM public.departments
  WHERE name ILIKE '%suporte%' AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_suporte IS NULL THEN
    RAISE WARNING '[orphan-fix] Dept Suporte não encontrado! Pulando correção de orphans.';
    RETURN;
  END IF;

  RAISE NOTICE '[orphan-fix] Dept Suporte ID: %', v_suporte;

  -- Atribuir Suporte a TODAS as conversas abertas sem departamento
  UPDATE public.conversations
  SET department = v_suporte,
      updated_at = now()
  WHERE department IS NULL
    AND status = 'open';

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RAISE NOTICE '[orphan-fix] Conversas sem dept corrigidas: %', v_updated;

  -- Criar dispatch jobs para as que precisam de atendente
  INSERT INTO public.conversation_dispatch_jobs (conversation_id, department_id, priority)
  SELECT c.id, v_suporte, 1
  FROM public.conversations c
  WHERE c.department = v_suporte
    AND c.ai_mode IN ('waiting_human', 'copilot')
    AND c.assigned_to IS NULL
    AND c.status = 'open'
  ON CONFLICT (conversation_id)
  DO UPDATE SET
    department_id   = EXCLUDED.department_id,
    status          = 'pending',
    next_attempt_at = now(),
    updated_at      = now();

  GET DIAGNOSTICS v_jobs = ROW_COUNT;
  RAISE NOTICE '[orphan-fix] Dispatch jobs criados/reativados: %', v_jobs;

END $$;

-- ===========================================================
-- PARTE 3: LIBERAR FLOW STATES PRESOS (> 30 min)
-- ===========================================================

DO $$
DECLARE
  v_freed INT;
BEGIN
  UPDATE public.chat_flow_states
  SET status = 'transferred',
      completed_at = now()
  WHERE status IN ('waiting_input', 'active', 'in_progress')
    AND updated_at < now() - INTERVAL '30 minutes'
    AND conversation_id IN (
      SELECT id FROM public.conversations WHERE status = 'open'
    );

  GET DIAGNOSTICS v_freed = ROW_COUNT;
  RAISE NOTICE '[flow-fix] Flow states presos liberados: %', v_freed;
END $$;

-- ===========================================================
-- VERIFICAÇÃO FINAL — Rode depois e confira os números
-- ===========================================================

-- Conversas ainda sem dept (deve ser 0)
SELECT COUNT(*) AS orphans_sem_dept
FROM public.conversations
WHERE department IS NULL AND status = 'open';

-- Conversas waiting_human/copilot sem dispatch job pendente
SELECT COUNT(*) AS sem_dispatch
FROM public.conversations c
LEFT JOIN public.conversation_dispatch_jobs cj
  ON cj.conversation_id = c.id AND cj.status = 'pending'
WHERE c.ai_mode IN ('waiting_human', 'copilot')
  AND c.assigned_to IS NULL
  AND c.status = 'open'
  AND cj.id IS NULL;

-- Top 10 conversas que precisam de atenção
SELECT
  LEFT(c.id::text, 8)      AS conv,
  c.ai_mode,
  d.name                   AS dept,
  c.assigned_to IS NOT NULL AS tem_agente,
  cj.status                AS dispatch_status,
  cj.dispatch_attempts,
  c.updated_at
FROM public.conversations c
LEFT JOIN public.departments d ON d.id = c.department
LEFT JOIN public.conversation_dispatch_jobs cj ON cj.conversation_id = c.id
WHERE c.status = 'open'
  AND c.ai_mode IN ('waiting_human', 'copilot')
ORDER BY c.updated_at ASC
LIMIT 10;
