-- ============================================
-- SECURITY FIX: Restrict web_chat conversations to session owners
-- ============================================
-- Issue: Any anonymous user can read any web_chat conversation if they know the ID
-- Solution: Implement session token authentication for anonymous users

-- 1. Add session_token column to conversations
ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS session_token TEXT;

-- 2. Create index for fast session_token lookups
CREATE INDEX IF NOT EXISTS idx_conversations_session_token 
ON public.conversations(session_token) 
WHERE channel = 'web_chat';

-- 3. Drop existing permissive public policies
DROP POLICY IF EXISTS "public_can_read_web_chat_conversations" ON public.conversations;
DROP POLICY IF EXISTS "public_can_update_web_chat_last_message" ON public.conversations;

-- 4. Create secure session-scoped policies
-- Anonymous users can only SELECT conversations with their session_token
CREATE POLICY "anon_can_read_own_web_chat_session"
ON public.conversations
FOR SELECT
TO anon
USING (
  channel = 'web_chat' 
  AND session_token IS NOT NULL
  AND session_token = current_setting('request.headers', true)::json->>'x-session-token'
);

-- Anonymous users can only UPDATE conversations with their session_token
CREATE POLICY "anon_can_update_own_web_chat_session"
ON public.conversations
FOR UPDATE
TO anon
USING (
  channel = 'web_chat' 
  AND session_token IS NOT NULL
  AND session_token = current_setting('request.headers', true)::json->>'x-session-token'
)
WITH CHECK (
  channel = 'web_chat' 
  AND session_token IS NOT NULL
  AND session_token = current_setting('request.headers', true)::json->>'x-session-token'
);

-- 5. Add comment explaining security model
COMMENT ON COLUMN public.conversations.session_token IS 
'SECURITY: Session token for anonymous web_chat users. Generated on conversation creation and used to scope RLS policies, ensuring visitors can only access their own conversations.';

-- 6. Create function to generate secure session tokens
CREATE OR REPLACE FUNCTION public.generate_session_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Generate 32-character random token
  RETURN encode(gen_random_bytes(24), 'hex');
END;
$$;

COMMENT ON FUNCTION public.generate_session_token IS 
'Generates a secure random session token for anonymous web_chat users.';