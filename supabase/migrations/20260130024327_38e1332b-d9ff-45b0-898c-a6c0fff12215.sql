-- 1. Adicionar campos na tabela departments para configuração de auto-close
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS auto_close_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS auto_close_minutes integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS send_rating_on_close boolean DEFAULT true;

COMMENT ON COLUMN departments.auto_close_enabled IS 'Habilita auto-encerramento por inatividade';
COMMENT ON COLUMN departments.auto_close_minutes IS 'Minutos de inatividade para fechar (NULL = nunca)';
COMMENT ON COLUMN departments.send_rating_on_close IS 'Enviar pesquisa CSAT ao fechar';

-- 2. Adicionar campo closed_reason na tabela conversations
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS closed_reason text DEFAULT NULL;

COMMENT ON COLUMN conversations.closed_reason IS 'Motivo: inactivity | manual | system';

-- 3. Adicionar department_id na tabela conversation_ratings
ALTER TABLE conversation_ratings 
ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id);

CREATE INDEX IF NOT EXISTS idx_conversation_ratings_department 
ON conversation_ratings(department_id);