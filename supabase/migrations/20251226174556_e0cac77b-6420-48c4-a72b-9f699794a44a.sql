-- Limpar job travado
UPDATE sync_jobs 
SET status = 'failed', 
    completed_at = now(), 
    errors = '[{"message": "Job travado - timeout na edge function"}]'::jsonb
WHERE id = 'b236c617-d150-46ed-8300-9603dafff832' AND status = 'running';

-- Criar tabela de fila para importação Kiwify em lotes
CREATE TABLE IF NOT EXISTS kiwify_import_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES sync_jobs(id) ON DELETE CASCADE,
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  contacts_created INTEGER DEFAULT 0,
  contacts_updated INTEGER DEFAULT 0,
  contacts_skipped INTEGER DEFAULT 0,
  sales_fetched INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_kiwify_import_queue_status ON kiwify_import_queue(status);
CREATE INDEX IF NOT EXISTS idx_kiwify_import_queue_scheduled ON kiwify_import_queue(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_kiwify_import_queue_job ON kiwify_import_queue(job_id);

-- RLS
ALTER TABLE kiwify_import_queue ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "admin_manager_can_view_kiwify_queue"
  ON kiwify_import_queue FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "admin_manager_can_manage_kiwify_queue"
  ON kiwify_import_queue FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Permitir que service role insira/atualize (para edge functions)
CREATE POLICY "service_role_full_access_kiwify_queue"
  ON kiwify_import_queue FOR ALL
  USING (auth.role() = 'service_role');

-- Comentários
COMMENT ON TABLE kiwify_import_queue IS 'Fila de importação de contatos Kiwify em janelas de 90 dias';