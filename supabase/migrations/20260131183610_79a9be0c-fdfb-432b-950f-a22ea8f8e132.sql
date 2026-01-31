-- ========================================
-- ENTERPRISE INBOX V2: Idempotência + Tracking
-- ========================================

-- 1. Adicionar client_message_id (UUID gerado no frontend)
-- Permite NULL para mensagens antigas (backwards compatible)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_message_id uuid;

-- 2. Adicionar provider_message_id (wamid do WhatsApp Meta)
-- Para reconciliação de status (delivered/read)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS provider_message_id text;

-- 3. UNIQUE constraint parcial (permite NULL para legado)
-- Garante que retry com mesmo client_message_id não duplica
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_message_id 
ON messages (client_message_id) 
WHERE client_message_id IS NOT NULL;

-- 4. Índice para busca por provider_message_id (webhooks de status)
CREATE INDEX IF NOT EXISTS idx_messages_provider_message_id 
ON messages (provider_message_id) 
WHERE provider_message_id IS NOT NULL;

-- 5. Comentário de contrato
COMMENT ON COLUMN messages.client_message_id IS 
  'UUID gerado no frontend para dedup. V2+: OBRIGATÓRIO em novas mensagens.';
COMMENT ON COLUMN messages.provider_message_id IS 
  'wamid do WhatsApp Meta para rastrear status (sent/delivered/read).';