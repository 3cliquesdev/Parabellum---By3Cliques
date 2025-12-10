
-- =============================================
-- EMAIL BUILDER V2 - ENTERPRISE INFRASTRUCTURE
-- =============================================

-- 1. Tabela principal de templates V2
CREATE TABLE public.email_templates_v2 (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom', -- onboarding, billing, recovery, support, promotion, custom
  trigger_type TEXT,
  default_subject TEXT,
  default_preheader TEXT,
  is_active BOOLEAN DEFAULT true,
  branding_id UUID REFERENCES public.email_branding(id) ON DELETE SET NULL,
  sender_id UUID REFERENCES public.email_senders(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE SET NULL,
  version INT DEFAULT 1,
  legacy_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  ab_testing_enabled BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Blocos arrastáveis do template
CREATE TABLE public.email_template_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.email_templates_v2(id) ON DELETE CASCADE,
  block_type TEXT NOT NULL, -- text, image, button, spacer, columns, banner, signature, divider, social, html
  position INT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}', -- { html, text, src, url, alt, buttonText, etc. }
  styles JSONB DEFAULT '{}', -- { backgroundColor, padding, margin, borderRadius, etc. }
  responsive JSONB DEFAULT '{"mobile": {}, "desktop": {}}', -- { mobile: { hidden: true }, desktop: {} }
  parent_block_id UUID REFERENCES public.email_template_blocks(id) ON DELETE CASCADE, -- For nested columns
  column_index INT, -- 0, 1, 2, 3 for columns layout
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Condicionais dinâmicas por bloco
CREATE TABLE public.email_block_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  block_id UUID NOT NULL REFERENCES public.email_template_blocks(id) ON DELETE CASCADE,
  field TEXT NOT NULL, -- contact.status, deal.value, contact.ltv, ticket.sla_status
  operator TEXT NOT NULL, -- equals, not_equals, greater_than, less_than, contains, is_empty, is_not_empty
  value TEXT NOT NULL,
  logic_group TEXT DEFAULT 'AND', -- AND, OR
  group_index INT DEFAULT 0, -- For grouping conditions
  action TEXT DEFAULT 'show', -- show, hide
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Variantes A/B
CREATE TABLE public.email_template_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.email_templates_v2(id) ON DELETE CASCADE,
  variant_name TEXT NOT NULL, -- A, B, C, Control
  subject TEXT NOT NULL,
  preheader TEXT,
  blocks_override JSONB, -- { blockId: { content: {...}, styles: {...} } }
  weight_percent INT DEFAULT 50 CHECK (weight_percent >= 0 AND weight_percent <= 100),
  is_control BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  -- Métricas
  total_sent INT DEFAULT 0,
  total_delivered INT DEFAULT 0,
  total_opened INT DEFAULT 0,
  total_clicked INT DEFAULT 0,
  total_bounced INT DEFAULT 0,
  total_spam INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Traduções multi-idioma
CREATE TABLE public.email_template_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.email_templates_v2(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL, -- pt-BR, en-US, es-ES
  subject TEXT NOT NULL,
  preheader TEXT,
  translated_blocks JSONB NOT NULL DEFAULT '{}', -- { blockId: { content: { html: "...", text: "..." } } }
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, language_code)
);

-- 6. Registro de envios (para métricas detalhadas)
CREATE TABLE public.email_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.email_templates_v2(id) ON DELETE SET NULL,
  variant_id UUID REFERENCES public.email_template_variants(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL,
  ticket_id UUID REFERENCES public.tickets(id) ON DELETE SET NULL,
  resend_email_id TEXT,
  subject TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  status TEXT DEFAULT 'sent', -- sent, delivered, opened, clicked, bounced, spam, failed
  language_code TEXT DEFAULT 'pt-BR',
  variables_used JSONB DEFAULT '{}',
  error_message TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Eventos de email (granular tracking)
CREATE TABLE public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id UUID NOT NULL REFERENCES public.email_sends(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- sent, delivered, opened, clicked, bounced, spam, replied
  event_data JSONB DEFAULT '{}', -- { link_url, user_agent, ip, etc. }
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Biblioteca de layouts prontos
CREATE TABLE public.email_layout_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- onboarding, billing, recovery, support, promotion
  preview_image_url TEXT,
  thumbnail_url TEXT,
  blocks JSONB NOT NULL DEFAULT '[]', -- Array de blocos pré-configurados
  default_styles JSONB DEFAULT '{}',
  is_system BOOLEAN DEFAULT false, -- Templates do sistema (não editáveis)
  is_active BOOLEAN DEFAULT true,
  usage_count INT DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Definições de variáveis dinâmicas
CREATE TABLE public.email_variable_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variable_key TEXT UNIQUE NOT NULL, -- contact.first_name, deal.value
  display_name TEXT NOT NULL,
  category TEXT NOT NULL, -- contact, deal, ticket, product, consultant, system
  data_type TEXT DEFAULT 'string', -- string, number, date, currency, boolean
  sample_value TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- INDEXES PARA PERFORMANCE
-- =============================================

CREATE INDEX idx_email_blocks_template ON public.email_template_blocks(template_id);
CREATE INDEX idx_email_blocks_parent ON public.email_template_blocks(parent_block_id);
CREATE INDEX idx_email_blocks_position ON public.email_template_blocks(template_id, position);
CREATE INDEX idx_email_conditions_block ON public.email_block_conditions(block_id);
CREATE INDEX idx_email_variants_template ON public.email_template_variants(template_id);
CREATE INDEX idx_email_translations_template ON public.email_template_translations(template_id);
CREATE INDEX idx_email_sends_template ON public.email_sends(template_id);
CREATE INDEX idx_email_sends_contact ON public.email_sends(contact_id);
CREATE INDEX idx_email_sends_status ON public.email_sends(status);
CREATE INDEX idx_email_sends_sent_at ON public.email_sends(sent_at DESC);
CREATE INDEX idx_email_events_send ON public.email_events(send_id);
CREATE INDEX idx_email_events_type ON public.email_events(event_type);
CREATE INDEX idx_email_layout_category ON public.email_layout_library(category);
CREATE INDEX idx_email_variables_category ON public.email_variable_definitions(category);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.email_templates_v2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_block_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_layout_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_variable_definitions ENABLE ROW LEVEL SECURITY;

-- Templates V2 - Admin/Manager full access, others view only
CREATE POLICY "admin_manager_full_access_templates_v2" ON public.email_templates_v2
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY "authenticated_view_templates_v2" ON public.email_templates_v2
FOR SELECT TO authenticated
USING (is_active = true);

-- Blocks - Same as templates
CREATE POLICY "admin_manager_full_access_blocks" ON public.email_template_blocks
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY "authenticated_view_blocks" ON public.email_template_blocks
FOR SELECT TO authenticated
USING (true);

-- Conditions - Same as blocks
CREATE POLICY "admin_manager_full_access_conditions" ON public.email_block_conditions
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY "authenticated_view_conditions" ON public.email_block_conditions
FOR SELECT TO authenticated
USING (true);

-- Variants - Same as templates
CREATE POLICY "admin_manager_full_access_variants" ON public.email_template_variants
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY "authenticated_view_variants" ON public.email_template_variants
FOR SELECT TO authenticated
USING (is_active = true);

-- Translations - Same as templates
CREATE POLICY "admin_manager_full_access_translations" ON public.email_template_translations
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY "authenticated_view_translations" ON public.email_template_translations
FOR SELECT TO authenticated
USING (is_active = true);

-- Email Sends - Admin/Manager view all, service can insert
CREATE POLICY "admin_manager_view_all_sends" ON public.email_sends
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role) OR
  public.has_role(auth.uid(), 'financial_manager'::app_role)
);

CREATE POLICY "service_insert_sends" ON public.email_sends
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "service_update_sends" ON public.email_sends
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

-- Email Events - Same as sends
CREATE POLICY "admin_manager_view_all_events" ON public.email_events
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role) OR
  public.has_role(auth.uid(), 'general_manager'::app_role)
);

CREATE POLICY "service_insert_events" ON public.email_events
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Layout Library - Public view, admin manage
CREATE POLICY "everyone_view_layouts" ON public.email_layout_library
FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "admin_manager_manage_layouts" ON public.email_layout_library
FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role) OR
  public.has_role(auth.uid(), 'manager'::app_role)
);

-- Variable Definitions - Public view
CREATE POLICY "everyone_view_variables" ON public.email_variable_definitions
FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "admin_manage_variables" ON public.email_variable_definitions
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================
-- SEED DATA: VARIÁVEIS DINÂMICAS
-- =============================================

INSERT INTO public.email_variable_definitions (variable_key, display_name, category, data_type, sample_value, description) VALUES
-- Contact
('contact.first_name', 'Primeiro Nome', 'contact', 'string', 'João', 'Nome do contato'),
('contact.last_name', 'Sobrenome', 'contact', 'string', 'Silva', 'Sobrenome do contato'),
('contact.full_name', 'Nome Completo', 'contact', 'string', 'João Silva', 'Nome completo do contato'),
('contact.email', 'Email', 'contact', 'string', 'joao@email.com', 'Email do contato'),
('contact.phone', 'Telefone', 'contact', 'string', '(11) 99999-9999', 'Telefone do contato'),
('contact.company', 'Empresa', 'contact', 'string', 'Empresa LTDA', 'Empresa do contato'),
('contact.ltv', 'Lifetime Value', 'contact', 'currency', 'R$ 5.000,00', 'Valor total em compras'),
('contact.status', 'Status', 'contact', 'string', 'customer', 'Status do contato (lead, customer, churned)'),
('contact.subscription_plan', 'Plano', 'contact', 'string', 'Premium', 'Plano de assinatura'),
('contact.account_balance', 'Saldo', 'contact', 'currency', 'R$ 250,00', 'Saldo em conta'),
-- Deal
('deal.title', 'Título do Negócio', 'deal', 'string', 'Proposta Comercial', 'Nome do negócio'),
('deal.value', 'Valor do Negócio', 'deal', 'currency', 'R$ 1.500,00', 'Valor do negócio'),
('deal.stage', 'Etapa do Funil', 'deal', 'string', 'Negociação', 'Etapa atual do deal'),
('deal.expected_close_date', 'Previsão de Fechamento', 'deal', 'date', '15/01/2025', 'Data prevista para fechar'),
('deal.probability', 'Probabilidade', 'deal', 'number', '75%', 'Chance de ganhar'),
-- Ticket
('ticket.number', 'Número do Ticket', 'ticket', 'string', '#12345', 'ID do ticket'),
('ticket.subject', 'Assunto', 'ticket', 'string', 'Dúvida sobre produto', 'Assunto do ticket'),
('ticket.status', 'Status do Ticket', 'ticket', 'string', 'Em andamento', 'Status atual'),
('ticket.priority', 'Prioridade', 'ticket', 'string', 'Alta', 'Nível de prioridade'),
('ticket.sla_status', 'Status SLA', 'ticket', 'string', 'Dentro do prazo', 'Situação do SLA'),
-- Product
('product.name', 'Nome do Produto', 'product', 'string', 'Curso Shopee', 'Nome do produto'),
('product.price', 'Preço', 'product', 'currency', 'R$ 997,00', 'Preço do produto'),
('product.description', 'Descrição', 'product', 'string', 'Curso completo...', 'Descrição do produto'),
-- Consultant
('consultant.name', 'Nome do Consultor', 'consultant', 'string', 'Maria Santos', 'Nome do consultor atribuído'),
('consultant.email', 'Email do Consultor', 'consultant', 'string', 'maria@empresa.com', 'Email do consultor'),
('consultant.phone', 'Telefone do Consultor', 'consultant', 'string', '(11) 98888-8888', 'Telefone do consultor'),
-- Sales Rep
('sales_rep.name', 'Nome do Vendedor', 'sales_rep', 'string', 'Carlos Oliveira', 'Nome do vendedor'),
('sales_rep.email', 'Email do Vendedor', 'sales_rep', 'string', 'carlos@empresa.com', 'Email do vendedor'),
-- System
('system.current_date', 'Data Atual', 'system', 'date', '10/12/2025', 'Data de hoje'),
('system.current_time', 'Hora Atual', 'system', 'string', '14:30', 'Hora atual'),
('system.company_name', 'Nome da Empresa', 'system', 'string', 'Seu Armazém Drop', 'Nome da sua empresa'),
('system.company_email', 'Email da Empresa', 'system', 'string', 'contato@empresa.com', 'Email de contato'),
('system.company_phone', 'Telefone da Empresa', 'system', 'string', '(11) 3000-0000', 'Telefone da empresa'),
('system.unsubscribe_link', 'Link de Descadastro', 'system', 'string', '{{unsubscribe}}', 'Link para descadastrar'),
('system.view_in_browser', 'Ver no Navegador', 'system', 'string', '{{browser_link}}', 'Link para ver no browser');

-- =============================================
-- SEED DATA: LAYOUTS PRONTOS DO SISTEMA
-- =============================================

INSERT INTO public.email_layout_library (name, description, category, is_system, blocks) VALUES
('Boas-vindas Simples', 'Layout clean para emails de boas-vindas', 'onboarding', true, '[
  {"type": "banner", "content": {"src": "", "alt": "Banner"}, "styles": {"backgroundColor": "#2563EB", "padding": "40px"}},
  {"type": "text", "content": {"html": "<h1>Bem-vindo, {{contact.first_name}}!</h1><p>Estamos felizes em ter você conosco.</p>"}, "styles": {"padding": "20px"}},
  {"type": "button", "content": {"text": "Começar Agora", "url": "#"}, "styles": {"backgroundColor": "#2563EB", "padding": "10px 30px"}},
  {"type": "spacer", "content": {"height": 40}},
  {"type": "signature", "content": {"name": "Equipe", "role": "Atendimento"}}
]'),
('Cobrança Pendente', 'Layout para lembretes de pagamento', 'billing', true, '[
  {"type": "text", "content": {"html": "<h2>⚠️ Pagamento Pendente</h2>"}, "styles": {"padding": "20px", "textAlign": "center"}},
  {"type": "text", "content": {"html": "<p>Olá {{contact.first_name}},</p><p>Identificamos que seu pagamento está pendente.</p>"}, "styles": {"padding": "20px"}},
  {"type": "text", "content": {"html": "<p><strong>Valor:</strong> {{deal.value}}</p>"}, "styles": {"padding": "10px 20px", "backgroundColor": "#FEF3C7"}},
  {"type": "button", "content": {"text": "Pagar Agora", "url": "#"}, "styles": {"backgroundColor": "#DC2626"}},
  {"type": "spacer", "content": {"height": 30}},
  {"type": "text", "content": {"html": "<p style=\"font-size: 12px;\">Se já realizou o pagamento, desconsidere este email.</p>"}}
]'),
('Recuperação de Cliente', 'Layout para reengajamento de clientes inativos', 'recovery', true, '[
  {"type": "text", "content": {"html": "<h2>Sentimos sua falta! 💙</h2>"}, "styles": {"padding": "30px", "textAlign": "center"}},
  {"type": "text", "content": {"html": "<p>Olá {{contact.first_name}},</p><p>Faz tempo que não nos vemos. Preparamos algo especial para você voltar!</p>"}, "styles": {"padding": "20px"}},
  {"type": "image", "content": {"src": "", "alt": "Oferta especial"}, "styles": {"padding": "20px"}},
  {"type": "button", "content": {"text": "Ver Oferta Especial", "url": "#"}, "styles": {"backgroundColor": "#059669"}},
  {"type": "spacer", "content": {"height": 30}}
]'),
('Ticket Resolvido', 'Notificação de resolução de ticket', 'support', true, '[
  {"type": "text", "content": {"html": "<h2>✅ Ticket Resolvido</h2>"}, "styles": {"padding": "20px", "textAlign": "center", "backgroundColor": "#D1FAE5"}},
  {"type": "text", "content": {"html": "<p>Olá {{contact.first_name}},</p><p>Seu ticket <strong>{{ticket.number}}</strong> foi resolvido.</p>"}, "styles": {"padding": "20px"}},
  {"type": "text", "content": {"html": "<p><strong>Assunto:</strong> {{ticket.subject}}</p>"}, "styles": {"padding": "10px 20px"}},
  {"type": "button", "content": {"text": "Avaliar Atendimento", "url": "#"}, "styles": {"backgroundColor": "#2563EB"}},
  {"type": "spacer", "content": {"height": 20}}
]'),
('Promoção Flash', 'Layout para promoções relâmpago', 'promotion', true, '[
  {"type": "banner", "content": {"src": "", "alt": "Promoção"}, "styles": {"backgroundColor": "#7C3AED", "padding": "40px", "color": "#FFFFFF"}},
  {"type": "text", "content": {"html": "<h1 style=\"color: #7C3AED;\">🔥 OFERTA EXCLUSIVA 🔥</h1>"}, "styles": {"padding": "20px", "textAlign": "center"}},
  {"type": "text", "content": {"html": "<p>{{contact.first_name}}, essa oferta é só para você!</p>"}, "styles": {"padding": "10px 20px", "textAlign": "center"}},
  {"type": "text", "content": {"html": "<h2 style=\"color: #DC2626;\">{{product.price}}</h2>"}, "styles": {"padding": "10px", "textAlign": "center"}},
  {"type": "button", "content": {"text": "GARANTIR AGORA", "url": "#"}, "styles": {"backgroundColor": "#DC2626", "fontSize": "18px", "padding": "15px 40px"}},
  {"type": "text", "content": {"html": "<p style=\"font-size: 12px;\">Oferta válida por tempo limitado.</p>"}, "styles": {"textAlign": "center"}}
]');

-- =============================================
-- TRIGGERS PARA UPDATED_AT
-- =============================================

CREATE TRIGGER update_email_templates_v2_updated_at
BEFORE UPDATE ON public.email_templates_v2
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_blocks_updated_at
BEFORE UPDATE ON public.email_template_blocks
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_variants_updated_at
BEFORE UPDATE ON public.email_template_variants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_translations_updated_at
BEFORE UPDATE ON public.email_template_translations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_email_layouts_updated_at
BEFORE UPDATE ON public.email_layout_library
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
