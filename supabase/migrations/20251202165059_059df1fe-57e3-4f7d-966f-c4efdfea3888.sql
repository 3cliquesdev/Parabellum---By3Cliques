-- FASE 1: Adicionar campo para notas internas na tabela messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;

-- Comentário descritivo
COMMENT ON COLUMN public.messages.is_internal IS 'True para mensagens visíveis apenas para a equipe interna (notas internas)';

-- Index para performance em queries que filtram notas internas
CREATE INDEX IF NOT EXISTS idx_messages_is_internal ON public.messages(is_internal) WHERE is_internal = true;