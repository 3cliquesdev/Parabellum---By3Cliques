-- =====================================================
-- ADICIONAR COLUNA metadata À TABELA messages
-- =====================================================
-- Esta coluna é usada pelas edge functions para armazenar
-- informações do provedor WhatsApp (Meta/Evolution),
-- status de entrega, e dados de verificação.

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT NULL;

-- Adicionar coluna external_id para tracking de mensagens externas
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS external_id TEXT DEFAULT NULL;

-- Índice para busca por external_id (usado para atualizar status de entrega)
CREATE INDEX IF NOT EXISTS idx_messages_external_id ON public.messages(external_id) WHERE external_id IS NOT NULL;

-- Índice GIN para buscas em metadata
CREATE INDEX IF NOT EXISTS idx_messages_metadata ON public.messages USING GIN(metadata) WHERE metadata IS NOT NULL;

COMMENT ON COLUMN public.messages.metadata IS 'Metadados do provedor (whatsapp_provider, status, timestamps, etc.)';
COMMENT ON COLUMN public.messages.external_id IS 'ID externo da mensagem no provedor (WhatsApp message ID)';