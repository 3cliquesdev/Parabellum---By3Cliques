-- FASE 1: Sistema de Presença e Roteamento Automático (ACD)

-- 1.1 Criar ENUM de status de disponibilidade
CREATE TYPE availability_status AS ENUM ('online', 'busy', 'offline');

-- 1.2 Adicionar colunas à tabela profiles
ALTER TABLE profiles 
ADD COLUMN availability_status availability_status DEFAULT 'offline' NOT NULL,
ADD COLUMN last_status_change TIMESTAMPTZ DEFAULT now();

-- 1.3 Comentários para documentação
COMMENT ON COLUMN profiles.availability_status IS 'Status de disponibilidade do agente para receber conversas: online (disponível), busy (ocupado), offline (indisponível)';
COMMENT ON COLUMN profiles.last_status_change IS 'Timestamp da última mudança de status de disponibilidade';

-- 1.4 Index para queries de roteamento (apenas usuários online)
CREATE INDEX idx_profiles_availability ON profiles(availability_status) WHERE availability_status = 'online';

-- 1.5 Criar tabela de fila de espera (fallback quando ninguém está online)
CREATE TABLE conversation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 0,
  queued_at TIMESTAMPTZ DEFAULT now(),
  assigned_at TIMESTAMPTZ,
  CONSTRAINT unique_conversation_queue UNIQUE(conversation_id)
);

-- 1.6 Index para otimizar queries de fila
CREATE INDEX idx_conversation_queue_priority ON conversation_queue(priority DESC, queued_at ASC) WHERE assigned_at IS NULL;

-- 1.7 Comentários para documentação
COMMENT ON TABLE conversation_queue IS 'Fila de espera para conversas quando nenhum agente está disponível';
COMMENT ON COLUMN conversation_queue.priority IS 'Prioridade da conversa na fila (maior = mais urgente)';
COMMENT ON COLUMN conversation_queue.queued_at IS 'Timestamp de entrada na fila';
COMMENT ON COLUMN conversation_queue.assigned_at IS 'Timestamp de atribuição a um agente (NULL = ainda na fila)';

-- 1.8 RLS policies para conversation_queue
ALTER TABLE conversation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Manager can view all queue items"
ON conversation_queue
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin/Manager can manage queue"
ON conversation_queue
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- 1.9 Trigger para atualizar last_status_change automaticamente
CREATE OR REPLACE FUNCTION update_availability_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.availability_status IS DISTINCT FROM OLD.availability_status THEN
    NEW.last_status_change = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_availability_status
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION update_availability_status_timestamp();

-- 1.10 Trigger para notificação Realtime quando conversa é atribuída
CREATE OR REPLACE FUNCTION notify_conversation_assignment()
RETURNS TRIGGER AS $$
BEGIN
  -- Quando assigned_to muda de NULL para algum agente, ou muda de agente
  IF (OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL) 
     OR (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) THEN
    -- O Realtime vai capturar essa mudança automaticamente
    -- Mas podemos adicionar metadata útil
    NEW.last_message_at = NOW(); -- Força update no timestamp para Realtime
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notify_conversation_assignment
BEFORE UPDATE ON conversations
FOR EACH ROW
EXECUTE FUNCTION notify_conversation_assignment();