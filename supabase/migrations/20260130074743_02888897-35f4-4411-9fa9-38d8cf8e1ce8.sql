-- D1) Adicionar colunas de controle de dispatch em conversations
ALTER TABLE conversations 
  ADD COLUMN IF NOT EXISTS dispatch_attempts INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_dispatch_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispatch_status TEXT DEFAULT 'pending';

-- D2) Criar tabela de jobs de distribuição
CREATE TABLE IF NOT EXISTS conversation_dispatch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),
  priority INTEGER DEFAULT 0,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 5,
  next_attempt_at TIMESTAMPTZ DEFAULT now(),
  last_error TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'escalated')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(conversation_id)
);

-- Índice para jobs pendentes
CREATE INDEX IF NOT EXISTS idx_dispatch_jobs_pending 
  ON conversation_dispatch_jobs(status, next_attempt_at) 
  WHERE status IN ('pending', 'processing');

-- D4) Criar tabela de logs de atribuição para auditoria
CREATE TABLE IF NOT EXISTS conversation_assignment_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  department_id UUID REFERENCES departments(id),
  assigned_to UUID REFERENCES profiles(id),
  algorithm TEXT NOT NULL,
  reason TEXT NOT NULL,
  candidates_count INTEGER DEFAULT 0,
  execution_time_ms INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignment_logs_conv ON conversation_assignment_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_assignment_logs_created ON conversation_assignment_logs(created_at DESC);

-- Enable RLS
ALTER TABLE conversation_dispatch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_assignment_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies para dispatch_jobs (apenas service role pode manipular)
CREATE POLICY "Service role full access on dispatch_jobs" ON conversation_dispatch_jobs
  FOR ALL USING (true) WITH CHECK (true);

-- RLS Policies para assignment_logs (admins podem ler)
CREATE POLICY "Authenticated users can view assignment logs" ON conversation_assignment_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role can insert assignment logs" ON conversation_assignment_logs
  FOR INSERT WITH CHECK (true);

-- D2) Trigger AFTER UPDATE para criar jobs automaticamente
CREATE OR REPLACE FUNCTION trigger_dispatch_on_waiting_human()
RETURNS TRIGGER AS $$
BEGIN
  -- Só dispara quando transiciona para waiting_human E não tem agente
  IF NEW.ai_mode = 'waiting_human' 
     AND NEW.assigned_to IS NULL 
     AND NEW.department IS NOT NULL
     AND NEW.status = 'open'
     AND (OLD.ai_mode IS DISTINCT FROM 'waiting_human' OR OLD.assigned_to IS NOT NULL)
  THEN
    INSERT INTO conversation_dispatch_jobs (conversation_id, department_id, priority)
    VALUES (NEW.id, NEW.department, 1)
    ON CONFLICT (conversation_id) 
    DO UPDATE SET 
      status = 'pending',
      attempts = 0,
      next_attempt_at = now(),
      updated_at = now()
    WHERE conversation_dispatch_jobs.status != 'completed';
    
    -- Atualizar status na conversa
    NEW.dispatch_status := 'pending';
    NEW.dispatch_attempts := 0;
  END IF;
  
  -- Se foi atribuído, marcar job como completo
  IF NEW.assigned_to IS NOT NULL AND OLD.assigned_to IS NULL THEN
    UPDATE conversation_dispatch_jobs 
    SET status = 'completed', updated_at = now()
    WHERE conversation_id = NEW.id;
    
    NEW.dispatch_status := 'assigned';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remover trigger antigo se existir e criar novo
DROP TRIGGER IF EXISTS trigger_conversation_dispatch ON conversations;
CREATE TRIGGER trigger_conversation_dispatch
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_dispatch_on_waiting_human();

-- Trigger para INSERT (novas conversas já em waiting_human)
CREATE OR REPLACE FUNCTION trigger_dispatch_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ai_mode = 'waiting_human' 
     AND NEW.assigned_to IS NULL 
     AND NEW.department IS NOT NULL
     AND NEW.status = 'open'
  THEN
    INSERT INTO conversation_dispatch_jobs (conversation_id, department_id, priority)
    VALUES (NEW.id, NEW.department, 1)
    ON CONFLICT (conversation_id) DO NOTHING;
    
    NEW.dispatch_status := 'pending';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_conversation_dispatch_insert ON conversations;
CREATE TRIGGER trigger_conversation_dispatch_insert
  BEFORE INSERT ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION trigger_dispatch_on_insert();