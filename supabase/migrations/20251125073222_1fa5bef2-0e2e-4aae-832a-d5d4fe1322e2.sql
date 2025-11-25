-- Permitir que visitantes não autenticados leiam mensagens de conversas web_chat
CREATE POLICY "public_can_read_web_chat_messages"
ON public.messages
FOR SELECT
TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.channel = 'web_chat'
  )
);

-- Permitir que visitantes não autenticados enviem mensagens em conversas web_chat
CREATE POLICY "public_can_insert_web_chat_messages"
ON public.messages
FOR INSERT
TO anon
WITH CHECK (
  sender_type = 'contact'
  AND EXISTS (
    SELECT 1 FROM public.conversations
    WHERE conversations.id = messages.conversation_id
    AND conversations.channel = 'web_chat'
  )
);

-- Permitir que visitantes não autenticados leiam dados de conversas web_chat
CREATE POLICY "public_can_read_web_chat_conversations"
ON public.conversations
FOR SELECT
TO anon
USING (channel = 'web_chat');