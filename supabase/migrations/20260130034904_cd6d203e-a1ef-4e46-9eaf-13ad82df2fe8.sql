-- Controle anti-spam de sugestões Copilot
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_suggestion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_classified_at TIMESTAMPTZ;

-- Índice para consultas de cooldown
CREATE INDEX IF NOT EXISTS idx_conversations_last_suggestion 
  ON conversations(last_suggestion_at);