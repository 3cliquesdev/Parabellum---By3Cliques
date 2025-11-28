-- FASE 1: Adicionar campo churn_risk na tabela deals
ALTER TABLE deals 
  ADD COLUMN IF NOT EXISTS churn_risk text 
  CHECK (churn_risk IN ('low', 'medium', 'high'));

COMMENT ON COLUMN deals.churn_risk IS 'Risco de churn percebido pelo vendedor durante a qualificação: low, medium, high';