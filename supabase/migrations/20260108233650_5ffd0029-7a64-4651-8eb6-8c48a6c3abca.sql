-- Tabela para mapear formulários a boards do Kanban
CREATE TABLE IF NOT EXISTS form_board_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID REFERENCES forms(id) ON DELETE CASCADE,
  board_id UUID REFERENCES project_boards(id) ON DELETE CASCADE,
  target_column_id UUID REFERENCES project_columns(id) ON DELETE SET NULL,
  auto_assign_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  send_confirmation_email BOOLEAN DEFAULT TRUE,
  confirmation_email_template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(form_id)
);

-- Adicionar card_id na form_submissions para rastrear cards criados
ALTER TABLE form_submissions ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES project_cards(id) ON DELETE SET NULL;

-- Habilitar RLS
ALTER TABLE form_board_integrations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para form_board_integrations
CREATE POLICY "form_board_integrations_select" ON form_board_integrations FOR SELECT USING (true);
CREATE POLICY "form_board_integrations_insert" ON form_board_integrations FOR INSERT WITH CHECK (true);
CREATE POLICY "form_board_integrations_update" ON form_board_integrations FOR UPDATE USING (true);
CREATE POLICY "form_board_integrations_delete" ON form_board_integrations FOR DELETE USING (true);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_form_board_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_form_board_integrations_updated_at
  BEFORE UPDATE ON form_board_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_form_board_integrations_updated_at();