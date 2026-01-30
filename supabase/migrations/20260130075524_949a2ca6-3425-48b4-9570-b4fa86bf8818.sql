-- ============================================
-- D2.1 - Trigger Enterprise Unificado (INSERT + UPDATE)
-- Verifica ESTADO ATUAL em vez de transição
-- ============================================

-- Função única para INSERT e UPDATE (BEFORE para poder modificar NEW)
CREATE OR REPLACE FUNCTION trigger_dispatch_on_waiting_human()
RETURNS TRIGGER AS $$
BEGIN
  -- Regra: "Se ESTÁ em waiting_human, sem agente, com dept, open → garante job"
  IF NEW.ai_mode = 'waiting_human' 
     AND NEW.assigned_to IS NULL 
     AND NEW.department IS NOT NULL
     AND NEW.status = 'open'
  THEN
    -- Upsert do job para garantir que existe
    INSERT INTO conversation_dispatch_jobs (conversation_id, department_id, priority)
    VALUES (NEW.id, NEW.department, 1)
    ON CONFLICT (conversation_id) 
    DO UPDATE SET 
      status = CASE 
        WHEN conversation_dispatch_jobs.status = 'completed' THEN conversation_dispatch_jobs.status
        ELSE 'pending'
      END,
      next_attempt_at = CASE 
        WHEN conversation_dispatch_jobs.status != 'completed' THEN now()
        ELSE conversation_dispatch_jobs.next_attempt_at
      END,
      updated_at = now();
    
    -- Atualizar status de dispatch na conversa
    NEW.dispatch_status := 'pending';
  END IF;
  
  -- Marcar como completo quando atribuído (só em UPDATE)
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    UPDATE conversation_dispatch_jobs 
    SET status = 'completed', updated_at = now()
    WHERE conversation_id = NEW.id AND status != 'completed';
    
    NEW.dispatch_status := 'assigned';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Remover triggers antigos
DROP TRIGGER IF EXISTS trigger_conversation_dispatch ON conversations;
DROP TRIGGER IF EXISTS trigger_conversation_dispatch_insert ON conversations;
DROP TRIGGER IF EXISTS trigger_conversation_dispatch_update ON conversations;

-- Criar trigger único para INSERT e UPDATE (BEFORE para poder modificar NEW)
CREATE TRIGGER trigger_conversation_dispatch
  BEFORE INSERT OR UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_dispatch_on_waiting_human();

-- ============================================
-- D4.1 - Atualizar CHECK constraint para incluir 'manual_only'
-- ============================================

-- Remover constraint antiga se existir
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_dispatch_status_check;

-- Adicionar nova constraint com 'manual_only'
ALTER TABLE conversations ADD CONSTRAINT conversations_dispatch_status_check 
  CHECK (dispatch_status IS NULL OR dispatch_status IN ('pending', 'in_progress', 'assigned', 'escalated', 'manual_only'));

-- ============================================
-- D2.2 - Job de Recuperação (Conversas Órfãs)
-- Cria jobs para conversas que estão travadas sem job
-- ============================================

INSERT INTO conversation_dispatch_jobs (conversation_id, department_id, priority)
SELECT c.id, c.department, 0
FROM conversations c
WHERE c.ai_mode = 'waiting_human'
  AND c.assigned_to IS NULL
  AND c.department IS NOT NULL
  AND c.status = 'open'
  AND NOT EXISTS (
    SELECT 1 FROM conversation_dispatch_jobs cdj 
    WHERE cdj.conversation_id = c.id 
      AND cdj.status IN ('pending', 'processing')
  )
ON CONFLICT (conversation_id) DO NOTHING;