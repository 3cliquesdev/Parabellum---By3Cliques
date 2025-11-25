-- FASE 1: Correção Crítica - RLS e Realtime para Chat Público

-- 1.1 Adicionar política UPDATE para conversations
-- Permitir que anon atualize last_message_at das conversas web_chat
CREATE POLICY "public_can_update_web_chat_last_message"
ON public.conversations
FOR UPDATE
TO anon
USING (channel = 'web_chat')
WITH CHECK (channel = 'web_chat');

-- 1.2 Garantir Realtime Habilitado para messages
-- Adicionar messages à publicação realtime (se já estiver, não faz nada)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Comentário explicativo
COMMENT ON POLICY "public_can_update_web_chat_last_message" ON public.conversations IS 
'Permite que visitantes anônimos atualizem o timestamp last_message_at de conversas web_chat quando enviam mensagens';