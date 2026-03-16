-- ============================================================
-- HOTFIX IMEDIATO: Corrigir conversas orphans e flow states presos
-- ATENÇÃO: Os IDs abaixo são PREFIXOS. Rode o SELECT primeiro para
-- confirmar os UUIDs completos antes de executar os UPDATEs.
-- Data: 2026-03-10
-- ============================================================

-- PASSO 1: Encontrar o ID do dept Suporte
SELECT id, name, is_active
FROM departments
WHERE name ILIKE '%suporte%'
ORDER BY created_at ASC;

-- PASSO 2: Verificar as conversas orphans (confirmar UUIDs)
SELECT
  id,
  LEFT(id::text, 8) AS prefix,
  ai_mode,
  department,
  assigned_to,
  status,
  created_at
FROM conversations
WHERE department IS NULL
  AND status = 'open'
ORDER BY created_at DESC;

-- PASSO 3: Verificar flow states presos (> 30 min no nó ia_entrada)
SELECT
  cfs.id,
  LEFT(cfs.conversation_id::text, 8) AS conv_prefix,
  cfs.current_node_id,
  cfs.status,
  cfs.updated_at,
  EXTRACT(EPOCH FROM (now() - cfs.updated_at))/60 AS minutos_preso
FROM chat_flow_states cfs
JOIN conversations c ON c.id = cfs.conversation_id
WHERE cfs.status IN ('waiting_input', 'active', 'in_progress')
  AND cfs.updated_at < now() - INTERVAL '30 minutes'
  AND c.status = 'open'
ORDER BY cfs.updated_at ASC;

-- ============================================================
-- APÓS CONFIRMAR OS IDs ACIMA, execute os blocos abaixo:
-- ============================================================

-- PASSO 4: Atribuir depto Suporte às conversas sem departamento
-- (substitua 'SEU_DEPT_SUPORTE_UUID' pelo UUID do Passo 1)
/*
UPDATE conversations
SET department = 'SEU_DEPT_SUPORTE_UUID',
    updated_at = now()
WHERE department IS NULL
  AND status = 'open';
*/

-- PASSO 5: Criar dispatch jobs para as conversas sem dept que viraram waiting_human/copilot
/*
INSERT INTO conversation_dispatch_jobs (conversation_id, department_id, priority)
SELECT c.id, 'SEU_DEPT_SUPORTE_UUID', 1
FROM conversations c
WHERE c.department = 'SEU_DEPT_SUPORTE_UUID'
  AND c.ai_mode IN ('waiting_human', 'copilot')
  AND c.assigned_to IS NULL
  AND c.status = 'open'
  AND c.updated_at >= now() - INTERVAL '24 hours'
ON CONFLICT (conversation_id)
DO UPDATE SET
  status          = 'pending',
  next_attempt_at = now(),
  updated_at      = now();
*/

-- PASSO 6: Cancelar flow states presos (> 30 min)
/*
UPDATE chat_flow_states
SET status = 'transferred',
    completed_at = now()
WHERE status IN ('waiting_input', 'active', 'in_progress')
  AND updated_at < now() - INTERVAL '30 minutes'
  AND conversation_id IN (
    SELECT id FROM conversations WHERE status = 'open'
  );
*/

-- PASSO 7: Verificação final
SELECT
  c.id,
  LEFT(c.id::text, 8) AS conv_prefix,
  c.ai_mode,
  d.name AS departamento,
  c.assigned_to IS NOT NULL AS tem_agente,
  cj.status AS dispatch_status,
  cj.dispatch_attempts
FROM conversations c
LEFT JOIN departments d ON d.id = c.department
LEFT JOIN conversation_dispatch_jobs cj ON cj.conversation_id = c.id
WHERE c.status = 'open'
  AND (c.department IS NULL OR c.ai_mode IN ('waiting_human', 'copilot'))
ORDER BY c.created_at DESC
LIMIT 20;
