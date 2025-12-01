-- Tabela de exemplos de treinamento (Few-Shot Learning)
CREATE TABLE ai_training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES ai_personas(id) ON DELETE CASCADE,
  input_text TEXT NOT NULL,
  ideal_output TEXT NOT NULL,
  category TEXT,
  scenario_type TEXT DEFAULT 'normal',
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de configurações de cenários
CREATE TABLE ai_scenario_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  system_instruction TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed data para cenários padrão
INSERT INTO ai_scenario_configs (name, system_instruction, description, icon, is_default) VALUES
('Normal', '', 'Interação padrão sem modificações de comportamento', '😊', true),
('Irritado', 'CONTEXTO DE AVALIAÇÃO: O cliente está muito insatisfeito e irritado. Use técnicas de desescalada, empatia profunda e foco em resolução rápida. Seja extremamente paciente e compreensivo.', 'Cliente insatisfeito - Testar desescalada e empatia', '😤', false),
('Confuso', 'CONTEXTO DE AVALIAÇÃO: O cliente é leigo e está confuso com termos técnicos. Use linguagem extremamente simples, evite jargões, use analogias do dia-a-dia e confirme compreensão frequentemente.', 'Cliente leigo - Testar clareza e simplicidade', '😕', false),
('Técnico', 'CONTEXTO DE AVALIAÇÃO: O cliente é expert técnico e espera profundidade. Use terminologia precisa, forneça detalhes técnicos específicos, mencione especificações e seja direto sem simplificações excessivas.', 'Cliente expert - Testar profundidade técnica', '🤓', false);

-- RLS Policies para ai_training_examples
ALTER TABLE ai_training_examples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin e Manager podem gerenciar exemplos de treinamento"
  ON ai_training_examples FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Authenticated users podem visualizar exemplos de treinamento"
  ON ai_training_examples FOR SELECT
  USING (auth.role() = 'authenticated');

-- RLS Policies para ai_scenario_configs
ALTER TABLE ai_scenario_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos authenticated podem visualizar cenários"
  ON ai_scenario_configs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin e Manager podem gerenciar cenários"
  ON ai_scenario_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'manager')
    )
  );

-- Trigger para updated_at
CREATE TRIGGER update_ai_training_examples_updated_at
  BEFORE UPDATE ON ai_training_examples
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();