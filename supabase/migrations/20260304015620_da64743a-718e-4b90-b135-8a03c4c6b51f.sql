
CREATE TABLE IF NOT EXISTS public.ai_decision_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  message_id UUID NULL,
  channel TEXT NULL,
  department TEXT NULL,
  rule_id UUID NULL,
  persona_id UUID NULL,
  decision TEXT NOT NULL CHECK (decision IN ('reply', 'handoff', 'blocked', 'ignored')),
  decision_reason TEXT NULL,
  correlation_id TEXT NOT NULL,
  error TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_created_at
  ON public.ai_decision_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_conversation
  ON public.ai_decision_logs(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_decision
  ON public.ai_decision_logs(decision, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_decision_logs_correlation
  ON public.ai_decision_logs(correlation_id);

ALTER TABLE public.ai_decision_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_ai_decision_logs" ON public.ai_decision_logs;

CREATE POLICY "service_role_ai_decision_logs"
ON public.ai_decision_logs
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');
