-- Adicionar flag para quando conversa precisa de review humano
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS needs_human_review boolean DEFAULT false;

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_conversations_needs_human_review 
ON conversations(needs_human_review) 
WHERE needs_human_review = true;