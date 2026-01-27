-- =====================================================
-- OTIMIZAÇÃO ENTERPRISE: Adicionar enum + indices
-- =====================================================

-- 1. Adicionar valor 'web_chat' ao enum communication_channel
-- (resolve erro: invalid input value for enum communication_channel)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'web_chat' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'communication_channel')
  ) THEN
    ALTER TYPE public.communication_channel ADD VALUE 'web_chat';
  END IF;
END $$;

-- 2. Índices otimizados para métricas (criados com CONCURRENTLY equivalente)
-- Índice para cálculo de First Response Time
CREATE INDEX IF NOT EXISTS idx_conversations_frt_calc 
ON conversations (created_at, first_response_at) 
WHERE first_response_at IS NOT NULL;

-- Índice para cálculo de Mean Time To Resolution
CREATE INDEX IF NOT EXISTS idx_conversations_mttr_calc 
ON conversations (created_at, closed_at) 
WHERE closed_at IS NOT NULL;

-- Índice para heatmap de conversas
CREATE INDEX IF NOT EXISTS idx_conversations_heatmap 
ON conversations (created_at);