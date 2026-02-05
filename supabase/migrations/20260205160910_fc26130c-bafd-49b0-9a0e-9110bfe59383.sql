-- =====================================================
-- CSAT Guard: Idempotência + Performance + Limpeza
-- =====================================================

-- 1. Restrição de Unicidade para idempotência atômica
-- Garante que cada conversa tenha no máximo 1 avaliação
ALTER TABLE conversation_ratings
ADD CONSTRAINT conversation_ratings_conversation_id_unique UNIQUE (conversation_id);

-- 2. Índice parcial otimizado para query do CSAT Guard
-- Roda em TODA mensagem recebida - precisa ser rápido
CREATE INDEX IF NOT EXISTS idx_conversations_csat_guard
ON conversations (contact_id, rating_sent_at DESC)
WHERE awaiting_rating = true AND status = 'closed';

-- 3. Limpeza do backlog: CSATs expirados (>48h desde envio) e legados sem rating_sent_at
UPDATE conversations 
SET awaiting_rating = false 
WHERE awaiting_rating = true 
  AND status = 'closed'
  AND (
    rating_sent_at < NOW() - INTERVAL '48 hours'
    OR (rating_sent_at IS NULL AND closed_at < NOW() - INTERVAL '48 hours')
  );