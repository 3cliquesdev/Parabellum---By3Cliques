
-- 1. Nova coluna em conversations para controle de keep-alive
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS window_keep_alive_sent_at TIMESTAMPTZ;

-- 2. Nova coluna em contacts para do-not-disturb
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS do_not_disturb BOOLEAN NOT NULL DEFAULT false;

-- 3. Nova tabela de auditoria window_keeper_logs
CREATE TABLE public.window_keeper_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.conversations(id),
  contact_id UUID REFERENCES public.contacts(id),
  trigger_reason TEXT NOT NULL,
  message_content TEXT,
  message_source TEXT NOT NULL CHECK (message_source IN ('ai_generated', 'safe_default', 'none')),
  ai_model TEXT,
  ai_tokens_used INTEGER,
  ai_latency_ms INTEGER,
  provider TEXT CHECK (provider IN ('meta', 'evolution')),
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  skipped_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.window_keeper_logs ENABLE ROW LEVEL SECURITY;

-- Management roles can view logs (using user_roles table)
CREATE POLICY "Managers can view window_keeper_logs"
ON public.window_keeper_logs
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'manager', 'general_manager', 'support_manager')
  )
);

-- Service role insert/update/delete (edge functions)
CREATE POLICY "Service role can manage window_keeper_logs"
ON public.window_keeper_logs
FOR ALL
USING (auth.uid() IS NULL)
WITH CHECK (auth.uid() IS NULL);

-- Indexes for performance
CREATE INDEX idx_window_keeper_logs_conversation_id ON public.window_keeper_logs(conversation_id);
CREATE INDEX idx_window_keeper_logs_contact_id_created ON public.window_keeper_logs(contact_id, created_at);
CREATE INDEX idx_window_keeper_logs_created_at ON public.window_keeper_logs(created_at);

-- Index on conversations for eligible query
CREATE INDEX IF NOT EXISTS idx_conversations_window_keeper 
ON public.conversations(status, channel, window_keep_alive_sent_at) 
WHERE status = 'open' AND channel = 'whatsapp';

-- 4. Trigger: reset window_keep_alive_sent_at when contact sends new message
CREATE OR REPLACE FUNCTION public.reset_window_keep_alive()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sender_type = 'contact' THEN
    UPDATE public.conversations
    SET window_keep_alive_sent_at = NULL
    WHERE id = NEW.conversation_id
    AND window_keep_alive_sent_at IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_reset_window_keep_alive
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.reset_window_keep_alive();
