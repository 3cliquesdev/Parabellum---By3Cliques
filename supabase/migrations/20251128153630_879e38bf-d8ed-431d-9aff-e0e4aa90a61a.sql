-- FASE 2: Campos de Qualificação e Handoff na tabela deals
ALTER TABLE deals 
  ADD COLUMN IF NOT EXISTS expected_revenue numeric,
  ADD COLUMN IF NOT EXISTS success_criteria text,
  ADD COLUMN IF NOT EXISTS pain_points text;

-- Comentários para documentação
COMMENT ON COLUMN deals.expected_revenue IS 'Faturamento mensal esperado do cliente (meta)';
COMMENT ON COLUMN deals.success_criteria IS 'O que é sucesso para esse cliente? (handoff para CS)';
COMMENT ON COLUMN deals.pain_points IS 'Principais dores e problemas do cliente';