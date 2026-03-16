-- ============================================================
-- Migration: AI Governor
-- Tabela para armazenar relatórios diários da IA Governante
-- e configuração do cron job (pg_cron)
-- ============================================================

-- 1. Tabela de relatórios da IA Governante
CREATE TABLE IF NOT EXISTS ai_governor_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date        date NOT NULL,
  metrics_snapshot  jsonb NOT NULL DEFAULT '{}',
  ai_analysis       text,
  sent_to_phones    text[] DEFAULT '{}',
  generated_at      timestamptz DEFAULT now(),
  created_at        timestamptz DEFAULT now(),

  CONSTRAINT ai_governor_reports_date_unique UNIQUE (date)
);

-- Índice para consulta por data
CREATE INDEX IF NOT EXISTS idx_ai_governor_reports_date
  ON ai_governor_reports (date DESC);

-- RLS: apenas service_role acessa
ALTER TABLE ai_governor_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON ai_governor_reports
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admins autenticados podem ler
CREATE POLICY "admins_read" ON ai_governor_reports
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'manager', 'super_admin')
    )
  );

-- ============================================================
-- 2. Configuração dos admins no system_configurations
-- Adiciona key para números de WhatsApp dos admins
-- (substitua pelos números reais no formato E.164 sem +)
-- ============================================================

INSERT INTO system_configurations (key, value, description)
VALUES (
  'ai_governor_admin_phones',
  '[]',
  'Lista de números WhatsApp dos admins para receber o relatório diário da IA Governante. Formato JSON array: ["5511999999999", "5521888888888"]'
)
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 3. pg_cron: Disparar ai-governor todo dia às 18h (horário UTC-3 = 21h UTC)
-- ATENÇÃO: Execute APENAS se pg_cron estiver habilitado no Supabase
-- Para habilitar: Database → Extensions → pg_cron
-- ============================================================

-- Remover job anterior se existir
SELECT cron.unschedule('ai-governor-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'ai-governor-daily'
);

-- Criar novo job: diariamente às 21h UTC (= 18h BRT)
SELECT cron.schedule(
  'ai-governor-daily',
  '0 21 * * *',
  $$
  SELECT net.http_post(
    url    := current_setting('app.supabase_url') || '/functions/v1/ai-governor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body   := '{}'::jsonb
  )
  $$
);

-- ============================================================
-- COMO VERIFICAR O CRON:
--   SELECT * FROM cron.job WHERE jobname = 'ai-governor-daily';
--   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- COMO TESTAR MANUALMENTE (sem esperar o cron):
--   Via curl:
--   curl -X POST https://SEU_PROJETO.supabase.co/functions/v1/ai-governor \
--     -H "Authorization: Bearer SEU_ANON_KEY" \
--     -H "Content-Type: application/json" \
--     -d '{"force_today": true, "admin_phones": ["5511999999999"]}'
-- ============================================================
