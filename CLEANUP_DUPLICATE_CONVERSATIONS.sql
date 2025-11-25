-- ===================================================================
-- LIMPEZA DE CONVERSAS DUPLICADAS (Singleton Conversation)
-- ===================================================================
-- 
-- Este script fecha conversas duplicadas do mesmo cliente, mantendo
-- apenas a conversa mais recente (baseado em last_message_at).
--
-- ATENÇÃO: Execute este script no SQL Editor do Supabase
-- ===================================================================

-- PASSO 1: Visualizar conversas duplicadas antes de fechar
-- (Execute primeiro para ver o que será afetado)
WITH ranked_conversations AS (
  SELECT 
    conv.id,
    conv.contact_id,
    cont.email,
    cont.first_name,
    cont.last_name,
    conv.created_at,
    conv.last_message_at,
    conv.status,
    ROW_NUMBER() OVER (
      PARTITION BY conv.contact_id 
      ORDER BY conv.last_message_at DESC NULLS LAST, conv.created_at DESC
    ) as rn
  FROM conversations conv
  JOIN contacts cont ON cont.id = conv.contact_id
  WHERE conv.status = 'open'
)
SELECT 
  id as conversation_id,
  contact_id,
  email,
  first_name || ' ' || last_name as customer_name,
  created_at,
  last_message_at,
  CASE WHEN rn = 1 THEN '✅ MANTER' ELSE '❌ FECHAR' END as action
FROM ranked_conversations
WHERE contact_id IN (
  SELECT contact_id 
  FROM ranked_conversations 
  GROUP BY contact_id 
  HAVING COUNT(*) > 1
)
ORDER BY email, rn;

-- ===================================================================
-- PASSO 2: Fechar conversas duplicadas (EXECUTAR APÓS REVISAR ACIMA)
-- ===================================================================
-- 
-- Descomente as linhas abaixo e execute para fechar as duplicatas:
-- ===================================================================

/*
WITH ranked_conversations AS (
  SELECT 
    conv.id,
    conv.contact_id,
    ROW_NUMBER() OVER (
      PARTITION BY conv.contact_id 
      ORDER BY conv.last_message_at DESC NULLS LAST, conv.created_at DESC
    ) as rn
  FROM conversations conv
  WHERE conv.status = 'open'
),
duplicates_to_close AS (
  SELECT id 
  FROM ranked_conversations 
  WHERE rn > 1
)

UPDATE conversations 
SET 
  status = 'closed',
  closed_at = NOW(),
  auto_closed = true
WHERE id IN (SELECT id FROM duplicates_to_close);
*/

-- ===================================================================
-- RESULTADO ESPERADO:
-- - Ronildo (teste@gmail.com): 7 conversas → 1 aberta, 6 fechadas
-- - Marco Cruz (marcomcruzz@gmail.com): 2 conversas → 1 aberta, 1 fechada
-- - Carlos Souza: 2 conversas → 1 aberta, 1 fechada
-- ===================================================================
