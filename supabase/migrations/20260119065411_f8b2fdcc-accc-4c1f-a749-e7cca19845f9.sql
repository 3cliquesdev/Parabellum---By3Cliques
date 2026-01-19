-- =============================================
-- PARTE 1: Criar tabela message_queue (se não existir)
-- =============================================

CREATE TABLE IF NOT EXISTS public.message_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID REFERENCES whatsapp_instances(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  phone_number TEXT NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  media_url TEXT,
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  scheduled_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance na fila
CREATE INDEX IF NOT EXISTS idx_message_queue_status ON message_queue(status);
CREATE INDEX IF NOT EXISTS idx_message_queue_instance_status ON message_queue(instance_id, status);
CREATE INDEX IF NOT EXISTS idx_message_queue_scheduled ON message_queue(scheduled_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_message_queue_phone ON message_queue(phone_number, instance_id);

-- =============================================
-- PARTE 2: Adicionar campos à rate_limits existente
-- =============================================

ALTER TABLE public.rate_limits 
ADD COLUMN IF NOT EXISTS max_per_minute INTEGER DEFAULT 8,
ADD COLUMN IF NOT EXISTS max_per_hour INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS max_per_day INTEGER DEFAULT 1000,
ADD COLUMN IF NOT EXISTS min_delay_same_number INTEGER DEFAULT 3000,
ADD COLUMN IF NOT EXISTS min_delay_any INTEGER DEFAULT 2000,
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS blocked_reason TEXT;

-- =============================================
-- PARTE 3: Logging de Qualidade IA
-- =============================================

CREATE TABLE IF NOT EXISTS public.ai_quality_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  persona_id UUID REFERENCES ai_personas(id) ON DELETE SET NULL,
  customer_message TEXT NOT NULL,
  ai_response TEXT,
  confidence_score DECIMAL(5,4),
  coverage_score DECIMAL(5,4),
  retrieval_score DECIMAL(5,4),
  had_conflicts BOOLEAN DEFAULT false,
  articles_used JSONB DEFAULT '[]',
  articles_count INTEGER DEFAULT 0,
  action_taken TEXT CHECK (action_taken IN ('direct', 'cautious', 'handoff', 'fallback')),
  handoff_reason TEXT,
  was_corrected BOOLEAN DEFAULT false,
  correction_by UUID REFERENCES profiles(id),
  correction_at TIMESTAMPTZ,
  feedback_type TEXT CHECK (feedback_type IN ('accurate', 'incorrect', 'partial', 'hallucination')),
  feedback_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para análise de qualidade
CREATE INDEX IF NOT EXISTS idx_ai_quality_logs_conversation ON ai_quality_logs(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_quality_logs_action ON ai_quality_logs(action_taken);
CREATE INDEX IF NOT EXISTS idx_ai_quality_logs_feedback ON ai_quality_logs(feedback_type) WHERE feedback_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_quality_logs_date ON ai_quality_logs(created_at);

-- =============================================
-- PARTE 4: Modo Conservador na ai_personas
-- =============================================

ALTER TABLE public.ai_personas 
ADD COLUMN IF NOT EXISTS conservative_mode BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS min_confidence_threshold DECIMAL(3,2) DEFAULT 0.85,
ADD COLUMN IF NOT EXISTS auto_handoff_on_low_confidence BOOLEAN DEFAULT true;

-- =============================================
-- RLS Policies (com IF NOT EXISTS via DO block)
-- =============================================

ALTER TABLE public.message_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_quality_logs ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  -- Message Queue policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_queue' AND policyname = 'Authenticated users can view message queue') THEN
    CREATE POLICY "Authenticated users can view message queue" ON public.message_queue FOR SELECT TO authenticated USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_queue' AND policyname = 'Authenticated users can insert to message queue') THEN
    CREATE POLICY "Authenticated users can insert to message queue" ON public.message_queue FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'message_queue' AND policyname = 'Authenticated users can update message queue') THEN
    CREATE POLICY "Authenticated users can update message queue" ON public.message_queue FOR UPDATE TO authenticated USING (true);
  END IF;

  -- AI Quality Logs policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_quality_logs' AND policyname = 'Authenticated users can view ai quality logs') THEN
    CREATE POLICY "Authenticated users can view ai quality logs" ON public.ai_quality_logs FOR SELECT TO authenticated USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_quality_logs' AND policyname = 'Authenticated users can insert ai quality logs') THEN
    CREATE POLICY "Authenticated users can insert ai quality logs" ON public.ai_quality_logs FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_quality_logs' AND policyname = 'Authenticated users can update ai quality logs') THEN
    CREATE POLICY "Authenticated users can update ai quality logs" ON public.ai_quality_logs FOR UPDATE TO authenticated USING (true);
  END IF;
END $$;

-- =============================================
-- Funções para rate limiting
-- =============================================

CREATE OR REPLACE FUNCTION public.update_rate_limit_counters(p_instance_id UUID)
RETURNS TABLE(can_send BOOLEAN, wait_ms INTEGER) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate_limit RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_can_send BOOLEAN := true;
  v_wait_ms INTEGER := 0;
BEGIN
  -- Obter ou criar rate limit para a instância
  INSERT INTO rate_limits (instance_id)
  VALUES (p_instance_id)
  ON CONFLICT (instance_id) DO NOTHING;
  
  SELECT * INTO v_rate_limit FROM rate_limits WHERE instance_id = p_instance_id FOR UPDATE;
  
  -- Reset contadores se necessário
  IF v_rate_limit.last_minute_reset < v_now - INTERVAL '1 minute' THEN
    UPDATE rate_limits SET minute_count = 0, last_minute_reset = v_now WHERE instance_id = p_instance_id;
    v_rate_limit.minute_count := 0;
  END IF;
  
  IF v_rate_limit.last_hour_reset < v_now - INTERVAL '1 hour' THEN
    UPDATE rate_limits SET hour_count = 0, last_hour_reset = v_now WHERE instance_id = p_instance_id;
    v_rate_limit.hour_count := 0;
  END IF;
  
  IF v_rate_limit.last_day_reset < v_now - INTERVAL '1 day' THEN
    UPDATE rate_limits SET day_count = 0, last_day_reset = v_now WHERE instance_id = p_instance_id;
    v_rate_limit.day_count := 0;
  END IF;
  
  -- Verificar se está bloqueado
  IF v_rate_limit.is_blocked AND v_rate_limit.blocked_until > v_now THEN
    v_can_send := false;
    v_wait_ms := EXTRACT(EPOCH FROM (v_rate_limit.blocked_until - v_now))::INTEGER * 1000;
  -- Verificar limites
  ELSIF v_rate_limit.minute_count >= COALESCE(v_rate_limit.max_per_minute, 8) THEN
    v_can_send := false;
    v_wait_ms := EXTRACT(EPOCH FROM (v_rate_limit.last_minute_reset + INTERVAL '1 minute' - v_now))::INTEGER * 1000;
  ELSIF v_rate_limit.hour_count >= COALESCE(v_rate_limit.max_per_hour, 200) THEN
    v_can_send := false;
    v_wait_ms := EXTRACT(EPOCH FROM (v_rate_limit.last_hour_reset + INTERVAL '1 hour' - v_now))::INTEGER * 1000;
  ELSIF v_rate_limit.day_count >= COALESCE(v_rate_limit.max_per_day, 1000) THEN
    v_can_send := false;
    v_wait_ms := EXTRACT(EPOCH FROM (v_rate_limit.last_day_reset + INTERVAL '1 day' - v_now))::INTEGER * 1000;
  END IF;
  
  RETURN QUERY SELECT v_can_send, GREATEST(v_wait_ms, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_rate_limit_counters(p_instance_id UUID)
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE rate_limits 
  SET 
    minute_count = minute_count + 1,
    hour_count = hour_count + 1,
    day_count = day_count + 1,
    updated_at = NOW()
  WHERE instance_id = p_instance_id;
END;
$$;

-- Enable realtime para monitoramento
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_queue;