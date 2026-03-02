
-- Message buffer for batching fragmented messages
CREATE TABLE public.message_buffer (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed BOOLEAN NOT NULL DEFAULT false
);

-- Index for fast lookup of unprocessed messages per conversation
CREATE INDEX idx_message_buffer_conv_unprocessed 
  ON public.message_buffer(conversation_id, processed, created_at)
  WHERE processed = false;

-- RLS: service role only (edge functions use service role key)
ALTER TABLE public.message_buffer ENABLE ROW LEVEL SECURITY;

-- Insert default batch delay config (8 seconds)
INSERT INTO public.system_configurations (key, value, category, description)
VALUES (
  'ai_message_batch_delay_seconds',
  '8',
  'ai',
  'Tempo de espera (em segundos) para acumular mensagens fragmentadas antes de processar com a IA. 0 = desativado.'
)
ON CONFLICT (key) DO NOTHING;
