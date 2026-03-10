-- Fix stuck conversations in ia_entrada: cancel flow states and move to waiting_human
-- Identifica conversas com flow state ativo em nós de IA que estão presas

-- 1. Cancelar flow states ativos que estão presos em nós de IA há mais de 30 min
UPDATE public.chat_flow_states 
SET status = 'cancelled', 
    completed_at = now()
WHERE status IN ('active', 'in_progress', 'waiting_input')
  AND current_node_id LIKE '%ia_%'
  AND started_at < now() - interval '30 minutes';

-- 2. Mover conversas órfãs para waiting_human com departamento Suporte
UPDATE public.conversations
SET ai_mode = 'waiting_human',
    department = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a'
WHERE id IN (
  SELECT DISTINCT conversation_id 
  FROM public.chat_flow_states 
  WHERE status = 'cancelled' 
    AND completed_at >= now() - interval '1 minute'
    AND current_node_id LIKE '%ia_%'
)
AND status = 'open'
AND assigned_to IS NULL;