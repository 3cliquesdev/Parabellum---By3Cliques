-- Adicionar tipo de interação para transferências de conversas
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'interaction_type') THEN
    CREATE TYPE interaction_type AS ENUM ('conversation_transferred');
  ELSE
    ALTER TYPE interaction_type ADD VALUE IF NOT EXISTS 'conversation_transferred';
  END IF;
END $$;

-- Adicionar coluna assigned_to na tabela conversations
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Criar índice para melhorar performance
CREATE INDEX IF NOT EXISTS idx_conversations_assigned_to ON conversations(assigned_to);

-- Popular campo assigned_to nas conversas existentes com o primeiro admin
UPDATE conversations 
SET assigned_to = (SELECT user_id FROM user_roles WHERE role = 'admin' LIMIT 1)
WHERE assigned_to IS NULL;

COMMENT ON COLUMN conversations.assigned_to IS 'Usuário responsável pela conversa';