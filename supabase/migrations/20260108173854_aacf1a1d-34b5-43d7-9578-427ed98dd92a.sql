-- =============================================
-- KANBAN AVANÇADO PARA PROJETOS DE LOJAS ONLINE
-- =============================================

-- 1. Tabela de Templates de Board
CREATE TABLE public.project_board_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  columns JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Boards de Projeto
CREATE TABLE public.project_boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  template_id UUID REFERENCES public.project_board_templates(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.profiles(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  due_date DATE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Colunas do Board
CREATE TABLE public.project_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.project_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6366f1',
  position INTEGER NOT NULL DEFAULT 0,
  is_final BOOLEAN DEFAULT false,
  email_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  notify_client_on_enter BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Labels do Board
CREATE TABLE public.project_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES public.project_boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Cards
CREATE TABLE public.project_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id UUID NOT NULL REFERENCES public.project_columns(id) ON DELETE CASCADE,
  board_id UUID NOT NULL REFERENCES public.project_boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  due_date TIMESTAMPTZ,
  start_date TIMESTAMPTZ,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  estimated_hours NUMERIC,
  actual_hours NUMERIC,
  cover_image_url TEXT,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Tabela de Responsáveis do Card (Multi-select)
CREATE TABLE public.project_card_assignees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.project_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_by UUID REFERENCES public.profiles(id),
  UNIQUE(card_id, user_id)
);

-- 7. Tabela de Labels do Card (Many-to-Many)
CREATE TABLE public.project_card_labels (
  card_id UUID NOT NULL REFERENCES public.project_cards(id) ON DELETE CASCADE,
  label_id UUID NOT NULL REFERENCES public.project_labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);

-- 8. Tabela de Checklists
CREATE TABLE public.project_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.project_cards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tabela de Items do Checklist
CREATE TABLE public.project_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID NOT NULL REFERENCES public.project_checklists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  position INTEGER DEFAULT 0,
  due_date TIMESTAMPTZ
);

-- 10. Tabela de Comentários (com @menções)
CREATE TABLE public.project_card_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.project_cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  content TEXT NOT NULL,
  mentions UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Tabela de Anexos
CREATE TABLE public.project_card_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES public.project_cards(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.profiles(id),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Tabela de Log de Atividades
CREATE TABLE public.project_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID REFERENCES public.project_boards(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.project_cards(id) ON DELETE SET NULL,
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ÍNDICES PARA PERFORMANCE
-- =============================================
CREATE INDEX idx_project_boards_deal ON public.project_boards(deal_id);
CREATE INDEX idx_project_boards_contact ON public.project_boards(contact_id);
CREATE INDEX idx_project_boards_status ON public.project_boards(status);
CREATE INDEX idx_project_columns_board ON public.project_columns(board_id);
CREATE INDEX idx_project_columns_position ON public.project_columns(board_id, position);
CREATE INDEX idx_project_cards_column ON public.project_cards(column_id);
CREATE INDEX idx_project_cards_board ON public.project_cards(board_id);
CREATE INDEX idx_project_cards_due_date ON public.project_cards(due_date);
CREATE INDEX idx_project_cards_position ON public.project_cards(column_id, position);
CREATE INDEX idx_project_card_assignees_card ON public.project_card_assignees(card_id);
CREATE INDEX idx_project_card_assignees_user ON public.project_card_assignees(user_id);
CREATE INDEX idx_project_card_comments_card ON public.project_card_comments(card_id);
CREATE INDEX idx_project_activity_board ON public.project_activity_log(board_id);
CREATE INDEX idx_project_activity_card ON public.project_activity_log(card_id);

-- =============================================
-- RLS POLICIES
-- =============================================
ALTER TABLE public.project_board_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_card_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_card_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_card_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_card_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_activity_log ENABLE ROW LEVEL SECURITY;

-- Templates - Visíveis para todos autenticados
CREATE POLICY "Templates visíveis para autenticados" ON public.project_board_templates
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Templates gerenciáveis por admin/manager" ON public.project_board_templates
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Boards - Visíveis para todos autenticados
CREATE POLICY "Boards visíveis para autenticados" ON public.project_boards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Boards criáveis por autenticados" ON public.project_boards
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Boards editáveis por autenticados" ON public.project_boards
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Boards deletáveis por admin/manager" ON public.project_boards
  FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Colunas - Acesso para autenticados
CREATE POLICY "Colunas acessíveis por autenticados" ON public.project_columns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Labels - Acesso para autenticados
CREATE POLICY "Labels acessíveis por autenticados" ON public.project_labels
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Cards - Acesso para autenticados
CREATE POLICY "Cards acessíveis por autenticados" ON public.project_cards
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Assignees - Acesso para autenticados
CREATE POLICY "Assignees acessíveis por autenticados" ON public.project_card_assignees
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Card Labels - Acesso para autenticados
CREATE POLICY "Card labels acessíveis por autenticados" ON public.project_card_labels
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Checklists - Acesso para autenticados
CREATE POLICY "Checklists acessíveis por autenticados" ON public.project_checklists
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Checklist Items - Acesso para autenticados
CREATE POLICY "Checklist items acessíveis por autenticados" ON public.project_checklist_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Comentários - Leitura para todos, escrita para autor
CREATE POLICY "Comentários visíveis" ON public.project_card_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Comentários criáveis" ON public.project_card_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Comentários editáveis pelo autor" ON public.project_card_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Comentários deletáveis pelo autor ou admin" ON public.project_card_comments
  FOR DELETE TO authenticated USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
  );

-- Anexos - Acesso para autenticados
CREATE POLICY "Anexos acessíveis por autenticados" ON public.project_card_attachments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Activity Log - Leitura para todos, escrita para autenticados
CREATE POLICY "Activity log visível" ON public.project_activity_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Activity log inserível" ON public.project_activity_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- =============================================
-- REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_columns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_card_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_card_assignees;

-- =============================================
-- STORAGE BUCKET PARA ANEXOS
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-attachments', 'project-attachments', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Anexos de projeto visíveis" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'project-attachments');

CREATE POLICY "Anexos de projeto uploadáveis" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-attachments');

CREATE POLICY "Anexos de projeto deletáveis" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'project-attachments');

-- =============================================
-- TRIGGER PARA UPDATED_AT
-- =============================================
CREATE OR REPLACE FUNCTION update_project_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_project_boards_updated_at
  BEFORE UPDATE ON public.project_boards
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_cards_updated_at
  BEFORE UPDATE ON public.project_cards
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_comments_updated_at
  BEFORE UPDATE ON public.project_card_comments
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

CREATE TRIGGER update_project_templates_updated_at
  BEFORE UPDATE ON public.project_board_templates
  FOR EACH ROW EXECUTE FUNCTION update_project_updated_at();

-- =============================================
-- TEMPLATE PADRÃO: LOJA ONLINE
-- =============================================
INSERT INTO public.project_board_templates (name, description, is_default, columns)
VALUES (
  'Loja Online Padrão',
  'Template padrão para projetos de criação de lojas online',
  true,
  '[
    {"name": "Briefing", "color": "#6366f1", "position": 0, "cards": [{"title": "Coletar Briefing do Cliente", "description": "- Nicho e produtos\n- Referências visuais\n- Cores e logo\n- Público-alvo\n- Funcionalidades especiais"}]},
    {"name": "Design", "color": "#8b5cf6", "position": 1, "cards": [{"title": "Layout Home", "description": "Criar design da página inicial"}, {"title": "Layout Produtos", "description": "Criar design das páginas de produto"}]},
    {"name": "Desenvolvimento", "color": "#3b82f6", "position": 2, "cards": [{"title": "Configurar Tema", "description": "Instalar e configurar tema base"}, {"title": "Implementar Design", "description": "Aplicar customizações visuais"}]},
    {"name": "Conteúdo", "color": "#10b981", "position": 3, "cards": [{"title": "Cadastrar Produtos", "description": "Adicionar produtos com fotos e descrições"}, {"title": "Páginas Institucionais", "description": "Criar páginas Sobre, Contato, Políticas"}]},
    {"name": "Integrações", "color": "#f59e0b", "position": 4, "cards": [{"title": "Pagamentos", "description": "Configurar gateways de pagamento"}, {"title": "Frete", "description": "Configurar opções de envio"}]},
    {"name": "Revisão", "color": "#ec4899", "position": 5, "cards": [{"title": "Testes", "description": "Testar fluxo completo de compra"}, {"title": "Ajustes Finais", "description": "Correções e otimizações"}]},
    {"name": "Concluído", "color": "#22c55e", "position": 6, "is_final": true, "cards": []}
  ]'::jsonb
);

-- =============================================
-- PERMISSÕES DE PROJETO NO SISTEMA RBAC
-- =============================================
INSERT INTO public.role_permissions (role, permission_key, permission_label, permission_category, enabled)
VALUES 
  ('admin', 'projects.view', 'Visualizar Projetos', 'projects', true),
  ('admin', 'projects.create', 'Criar Projetos', 'projects', true),
  ('admin', 'projects.manage', 'Gerenciar Projetos', 'projects', true),
  ('admin', 'projects.manage_templates', 'Gerenciar Templates', 'projects', true),
  ('manager', 'projects.view', 'Visualizar Projetos', 'projects', true),
  ('manager', 'projects.create', 'Criar Projetos', 'projects', true),
  ('manager', 'projects.manage', 'Gerenciar Projetos', 'projects', true),
  ('manager', 'projects.manage_templates', 'Gerenciar Templates', 'projects', true),
  ('sales_rep', 'projects.view', 'Visualizar Projetos', 'projects', true),
  ('sales_rep', 'projects.create', 'Criar Projetos', 'projects', true),
  ('consultant', 'projects.view', 'Visualizar Projetos', 'projects', true),
  ('consultant', 'projects.create', 'Criar Projetos', 'projects', true),
  ('support_manager', 'projects.view', 'Visualizar Projetos', 'projects', true),
  ('support_agent', 'projects.view', 'Visualizar Projetos', 'projects', true)
ON CONFLICT (role, permission_key) DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE public.project_boards IS 'Boards de projeto estilo Kanban para gerenciar criação de lojas online';
COMMENT ON TABLE public.project_cards IS 'Cards/tarefas dentro dos boards de projeto';
COMMENT ON TABLE public.project_card_comments IS 'Comentários nos cards com suporte a @menções';