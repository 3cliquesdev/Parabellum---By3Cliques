-- ============================================================
-- HOTFIX: 4 Bugs Críticos de IA + Chat Flow
-- Data: 2026-03-10
-- 
-- BUG 1: Trigger AFTER não pode modificar NEW.department
--         → Recriar como BEFORE + cobrir autopilot sem dept
-- BUG 2: Dispatch não cobre ai_mode = 'copilot'
--         → Expandir condição para copilot também
-- FIX 3: Conversas orphans agora (5 sem dept + 2 copilot sem agente)
-- FIX 4: Flow states presos → cancelar e reprocessar
-- ============================================================

-- ===========================================================
-- PARTE 1: RECRIAR TRIGGER COMO BEFORE (Fix BUG 1 + BUG 2)
-- ===========================================================

-- 1A: Dropar triggers antigos (AFTER)
DROP TRIGGER IF EXISTS trg_dispatch_on_conversation_insert ON public.conversations;
DROP TRIGGER IF EXISTS trg_dispatch_on_conversation_update ON public.conversations;
DROP TRIGGER IF EXISTS trigger_conversation_dispatch ON public.conversations;

-- 1B: Reescrever função com lógica corrigida
CREATE OR REPLACE FUNCTION public.ensure_dispatch_job()
RETURNS TRIGGER AS $$
DECLARE
  v_suporte_dept_id UUID;
BEGIN
  -- ──────────────────────────────────────────────────────
  -- LÓGICA 1: Atribuir departamento Suporte quando NULL
  -- Só funciona em BEFORE trigger (modifica NEW antes de salvar)
  -- Aplica quando conversa está ATIVA e sem dept
  -- ──────────────────────────────────────────────────────
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

  -- ──────────────────────────────────────────────────────
  -- LÓGICA 2: Criar/reativar dispatch job para distribuição
  -- Cobre: waiting_human E copilot (sem agente ainda)
  -- ──────────────────────────────────────────────────────
  IF NEW.ai_mode IN ('waiting_human', 'copilot')
     AND NEW.assigned_to IS NULL
     AND NEW.department IS NOT NULL   -- após possível atribuição acima
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
    
    RAISE LOG '[ensure_dispatch_job] Dispatch job criado/reativado para conv % dept % mode %',
      NEW.id, NEW.department, NEW.ai_mode;
  END IF;

  -- ──────────────────────────────────────────────────────
  -- LÓGICA 3: Encerrar dispatch job se agente foi atribuído
  -- ──────────────────────────────────────────────────────
  IF NEW.assigned_to IS NOT NULL THEN
    UPDATE public.conversation_dispatch_jobs
    SET status = 'completed', updated_at = now()
    WHERE conversation_id = NEW.id
      AND status <> 'completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 1C: Recriar como BEFORE triggers (essencial para NEW.department funcionar)
CREATE TRIGGER trg_dispatch_on_conversation_insert
  BEFORE INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_dispatch_job();

CREATE TRIGGER trg_dispatch_on_conversation_update
  BEFORE UPDATE OF ai_mode, assigned_to, department, status ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_dispatch_job();

-- ===========================================================
-- PARTE 2: CORRIGIR CONVERSAS ORPHANS AGORA (Fix imediato)
-- ===========================================================

-- 2A: Buscar ID do dept Suporte para usar nas atualizações
DO $$
DECLARE
  v_suporte UUID;
BEGIN
  SELECT id INTO v_suporte
  FROM public.departments
  WHERE name ILIKE '%suporte%' AND is_active = true
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_suporte IS NULL THEN
    RAISE EXCEPTION 'Departamento Suporte não encontrado! Verifique o nome do dept.';
  END IF;

  RAISE NOTICE 'Dept Suporte ID: %', v_suporte;

  -- 2B: Atualizar as 5 conversas sem departamento
  UPDATE public.conversations
  SET department = v_suporte,
      updated_at = now()
  WHERE id IN (
    '9f4027ea-0000-0000-0000-000000000000',  -- Tiago Camatta
    '83e38c1f-0000-0000-0000-000000000000',  -- Lucas Mugnol
    '5098c07f-0000-0000-0000-000000000000',  -- Casaiq
    '1a57232b-0000-0000-0000-000000000000',  -- sem nome
    '56e47f5c-0000-0000-0000-000000000000'   -- Ana
  )
  AND department IS NULL
  AND status = 'open';

  RAISE NOTICE 'Conversas orphans atualizadas: % rows', FOUND::int;

  -- 2C: Criar dispatch jobs para as 5 conversas orphans 
  -- (as que estão em waiting_human/copilot precisam de distribuição)
  INSERT INTO public.conversation_dispatch_jobs (conversation_id, department_id, priority)
  SELECT c.id, v_suporte, 1
  FROM public.conversations c
  WHERE c.id IN (
    '9f4027ea-0000-0000-0000-000000000000',
    '83e38c1f-0000-0000-0000-000000000000',
    '5098c07f-0000-0000-0000-000000000000',
    '1a57232b-0000-0000-0000-000000000000',
    '56e47f5c-0000-0000-0000-000000000000'
  )
  AND c.ai_mode IN ('waiting_human', 'copilot')
  AND c.assigned_to IS NULL
  AND c.status = 'open'
  ON CONFLICT (conversation_id)
  DO UPDATE SET
    department_id   = EXCLUDED.department_id,
    status          = 'pending',
    next_attempt_at = now(),
    updated_at      = now();

  -- 2D: As 2 conversas copilot sem agente (85904262, 0a6acf51)
  -- Já têm departamento Suporte, mas dispatch_attempts = 0
  -- Garantir que o job está ativo para elas
  INSERT INTO public.conversation_dispatch_jobs (conversation_id, department_id, priority)
  SELECT c.id, c.department, 1
  FROM public.conversations c
  WHERE c.id IN (
    '85904262-0000-0000-0000-000000000000',
    '0a6acf51-0000-0000-0000-000000000000'
  )
  AND c.department IS NOT NULL
  AND c.assigned_to IS NULL
  AND c.status = 'open'
  ON CONFLICT (conversation_id)
  DO UPDATE SET
    status          = 'pending',
    next_attempt_at = now(),
    updated_at      = now();

  RAISE NOTICE 'Dispatch jobs criados/reativados';
END $$;

-- ===========================================================
-- PARTE 3: LIBERAR FLOW STATES PRESOS
-- Nó 1769459318164 com estado > 30min
-- ===========================================================

-- Cancelar flow states presos para as conversas afetadas
UPDATE public.chat_flow_states
SET status = 'transferred',
    completed_at = now()
WHERE conversation_id IN (
  '85904262-0000-0000-0000-000000000000',
  '0a6acf51-0000-0000-0000-000000000000',
  '56e47f5c-0000-0000-0000-000000000000'
)
AND current_node_id = '1769459318164'
AND status IN ('waiting_input', 'active', 'in_progress')
AND updated_at < now() - INTERVAL '30 minutes';

-- ===========================================================
-- PARTE 4: VERIFICAÇÃO PÓS-EXECUÇÃO
-- ===========================================================

-- Mostrar estado atual das conversas afetadas
SELECT
  id,
  LEFT(id::text, 8) AS conv_short,
  ai_mode,
  department,
  assigned_to IS NOT NULL AS tem_agente,
  status,
  updated_at
FROM public.conversations
WHERE id IN (
  '9f4027ea-0000-0000-0000-000000000000',
  '83e38c1f-0000-0000-0000-000000000000',
  '5098c07f-0000-0000-0000-000000000000',
  '1a57232b-0000-0000-0000-000000000000',
  '56e47f5c-0000-0000-0000-000000000000',
  '85904262-0000-0000-0000-000000000000',
  '0a6acf51-0000-0000-0000-000000000000'
)
ORDER BY updated_at DESC;

-- Mostrar dispatch jobs ativos
SELECT
  LEFT(cj.conversation_id::text, 8) AS conv_short,
  cj.status,
  cj.dispatch_attempts,
  cj.department_id,
  cj.next_attempt_at
FROM public.conversation_dispatch_jobs cj
WHERE cj.conversation_id IN (
  '9f4027ea-0000-0000-0000-000000000000',
  '83e38c1f-0000-0000-0000-000000000000',
  '5098c07f-0000-0000-0000-000000000000',
  '1a57232b-0000-0000-0000-000000000000',
  '56e47f5c-0000-0000-0000-000000000000',
  '85904262-0000-0000-0000-000000000000',
  '0a6acf51-0000-0000-0000-000000000000'
)
ORDER BY cj.updated_at DESC;
