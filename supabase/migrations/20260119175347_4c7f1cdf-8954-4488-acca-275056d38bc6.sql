-- 1. Criar Pipeline de Recorrência para Upsells/Renovações
INSERT INTO pipelines (id, name, is_default)
SELECT gen_random_uuid(), 'Pipeline de Recorrência', false
WHERE NOT EXISTS (SELECT 1 FROM pipelines WHERE name = 'Pipeline de Recorrência');

-- 2. Criar stage "Ganho" para o Pipeline de Recorrência (sem coluna color)
INSERT INTO stages (id, pipeline_id, name, position)
SELECT gen_random_uuid(), p.id, 'Ganho', 1
FROM pipelines p
WHERE p.name = 'Pipeline de Recorrência'
AND NOT EXISTS (
  SELECT 1 FROM stages s 
  WHERE s.pipeline_id = p.id AND s.name = 'Ganho'
);

-- 3. Adicionar coluna lead_source se não existir (para rastreamento de fonte)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'deals' AND column_name = 'lead_source'
  ) THEN
    ALTER TABLE deals ADD COLUMN lead_source TEXT;
  END IF;
END $$;

-- 4. Criar índices para consultas por data de criação/fechamento e fonte
CREATE INDEX IF NOT EXISTS idx_deals_created_at ON deals(created_at);
CREATE INDEX IF NOT EXISTS idx_deals_closed_at ON deals(closed_at);
CREATE INDEX IF NOT EXISTS idx_deals_lead_source ON deals(lead_source);
CREATE INDEX IF NOT EXISTS idx_deals_status_created ON deals(status, created_at);