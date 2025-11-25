-- FASE 2: Identity Resolution Backend
-- Adicionar campo customer_metadata na tabela conversations

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS customer_metadata JSONB DEFAULT '{}'::jsonb;

-- Criar índice para queries eficientes
CREATE INDEX IF NOT EXISTS idx_conversations_customer_metadata 
ON public.conversations USING gin(customer_metadata);

COMMENT ON COLUMN public.conversations.customer_metadata IS 
'Armazena metadata do cliente: is_returning_customer (boolean), previous_interactions_count (integer), identified_at (timestamp)';