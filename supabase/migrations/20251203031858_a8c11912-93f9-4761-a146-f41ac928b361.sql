
-- FASE 1: Correções Críticas de Segurança RLS (FINAL)
-- Data: 2025-12-03

-- =====================================================
-- 5. MESSAGES - Restringir inserção anônima
-- =====================================================

DROP POLICY IF EXISTS "anon_can_insert_web_chat_messages" ON public.messages;

CREATE POLICY "session_validated_message_insert"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL OR
  (
    sender_type = 'contact' AND
    channel = 'web_chat' AND
    is_internal IS NOT TRUE AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = messages.conversation_id
      AND c.channel = 'web_chat'
      AND c.session_token IS NOT NULL
      AND c.session_token = (
        (current_setting('request.headers', true))::json->>'x-session-token'
      )
    )
  )
);

-- =====================================================
-- 6. CONVERSATION_RATINGS - Validar sessão
-- =====================================================

DROP POLICY IF EXISTS "ratings_require_valid_session" ON public.conversation_ratings;

CREATE POLICY "ratings_require_valid_session_strict"
ON public.conversation_ratings FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL OR
  (
    rating >= 1 AND rating <= 5 AND
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_ratings.conversation_id
      AND c.channel = 'web_chat'
      AND c.session_token IS NOT NULL
      AND c.session_token = (
        (current_setting('request.headers', true))::json->>'x-session-token'
      )
    )
  )
);
