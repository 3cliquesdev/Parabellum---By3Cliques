-- FASE 1: Add overdue status and Retenção pipeline

-- Add overdue status to customer_status enum
ALTER TYPE customer_status ADD VALUE IF NOT EXISTS 'overdue';

-- Create Retenção e Cobrança pipeline
INSERT INTO pipelines (id, name, is_default)
VALUES (gen_random_uuid(), 'Retenção e Cobrança', false)
ON CONFLICT DO NOTHING;

-- Create stages for Retenção pipeline
INSERT INTO stages (pipeline_id, name, position)
SELECT 
  p.id,
  stage_name,
  stage_position
FROM pipelines p
CROSS JOIN (
  VALUES 
    ('Cobrança Ativa', 0),
    ('Análise de Perda / Winback', 1)
) AS stages(stage_name, stage_position)
WHERE p.name = 'Retenção e Cobrança'
ON CONFLICT DO NOTHING;