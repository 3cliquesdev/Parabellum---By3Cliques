-- =====================================================
-- UPGRADE: Sistema Premium de Cadências de Prospecção
-- =====================================================

-- 1. Adicionar novos campos para lógica condicional em cadence_steps
ALTER TABLE cadence_steps ADD COLUMN IF NOT EXISTS condition_type TEXT;
-- Tipos: 'replied', 'email_opened', 'link_clicked', 'no_response'

ALTER TABLE cadence_steps ADD COLUMN IF NOT EXISTS condition_next_step_id UUID REFERENCES cadence_steps(id) ON DELETE SET NULL;
-- Para onde pular se condição for verdadeira

ALTER TABLE cadence_steps ADD COLUMN IF NOT EXISTS condition_else_step_id UUID REFERENCES cadence_steps(id) ON DELETE SET NULL;
-- Para onde ir se condição for falsa

-- 2. Adicionar posição visual no canvas (para React Flow)
ALTER TABLE cadence_steps ADD COLUMN IF NOT EXISTS position_x FLOAT DEFAULT 0;
ALTER TABLE cadence_steps ADD COLUMN IF NOT EXISTS position_y FLOAT DEFAULT 0;

-- 3. Criar tabela de templates de cadência
CREATE TABLE IF NOT EXISTS cadence_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE cadence_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies para cadence_templates (acesso de leitura para todos autenticados)
CREATE POLICY "Users can view active cadence templates"
ON cadence_templates FOR SELECT
TO authenticated
USING (is_active = true);

CREATE POLICY "Admins can manage cadence templates"
ON cadence_templates FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- 4. Adicionar coluna de métricas em cadences
ALTER TABLE cadences ADD COLUMN IF NOT EXISTS meetings_booked INT DEFAULT 0;
ALTER TABLE cadences ADD COLUMN IF NOT EXISTS total_responses INT DEFAULT 0;