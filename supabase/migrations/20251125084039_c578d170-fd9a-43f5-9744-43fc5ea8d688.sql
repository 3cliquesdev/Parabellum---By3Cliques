-- FASE 1: Adicionar campos de identidade nas mensagens

-- Adicionar 'system' ao ENUM sender_type
ALTER TYPE sender_type ADD VALUE IF NOT EXISTS 'system';

-- Adicionar sender_id (FK para profiles)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Adicionar is_ai_generated (flag para mensagens da IA)
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS is_ai_generated BOOLEAN DEFAULT false;

-- Criar índice para melhorar performance das queries com join
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

-- Comentários para documentação
COMMENT ON COLUMN public.messages.sender_id IS 'ID do usuário/agente que enviou a mensagem (NULL para IA)';
COMMENT ON COLUMN public.messages.is_ai_generated IS 'Flag indicando se a mensagem foi gerada automaticamente pela IA';
COMMENT ON TYPE sender_type IS 'Tipos de remetente: user (humano), contact (cliente), system (mensagem do sistema)';