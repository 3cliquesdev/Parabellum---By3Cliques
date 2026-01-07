-- Adicionar colunas para suportar diferentes tipos de steps no wizard
ALTER TABLE customer_journey_steps 
ADD COLUMN IF NOT EXISTS step_type TEXT DEFAULT 'task';

ALTER TABLE customer_journey_steps 
ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES forms(id);

-- Criar índice para queries por tipo
CREATE INDEX IF NOT EXISTS idx_customer_journey_steps_type ON customer_journey_steps(step_type);

-- Comentário para documentação
COMMENT ON COLUMN customer_journey_steps.step_type IS 'Tipo do step: task, form, etc.';
COMMENT ON COLUMN customer_journey_steps.form_id IS 'ID do formulário se step_type = form';