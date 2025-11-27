-- FASE 1: Criar tabela delivery_groups
CREATE TABLE delivery_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Admin/Manager podem gerenciar, todos autenticados podem ler
ALTER TABLE delivery_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manager_can_manage_delivery_groups" ON delivery_groups
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "authenticated_can_view_delivery_groups" ON delivery_groups
  FOR SELECT USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_delivery_groups_updated_at
  BEFORE UPDATE ON delivery_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- FASE 1: Criar tabela group_playbooks (N:N)
CREATE TABLE group_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES delivery_groups(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES onboarding_playbooks(id) ON DELETE CASCADE,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, playbook_id)
);

-- RLS
ALTER TABLE group_playbooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manager_can_manage_group_playbooks" ON group_playbooks
  FOR ALL USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "authenticated_can_view_group_playbooks" ON group_playbooks
  FOR SELECT USING (true);

-- FASE 1: Adicionar delivery_group_id na tabela products
ALTER TABLE products ADD COLUMN delivery_group_id UUID REFERENCES delivery_groups(id);