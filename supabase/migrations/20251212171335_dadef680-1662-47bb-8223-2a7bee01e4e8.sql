-- ============================================================
-- Sistema de Mensagens Padrão Editáveis para IA + Vinculação de Emails a Eventos
-- ============================================================

-- 1. Tabela de templates de mensagens da IA (editáveis via UI)
CREATE TABLE public.ai_message_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL, -- ex: 'saque_coleta_dados', 'saque_sucesso', 'otp_enviado'
  title TEXT NOT NULL, -- Nome amigável para exibição
  content TEXT NOT NULL, -- Conteúdo da mensagem (suporta {{variáveis}})
  category TEXT NOT NULL DEFAULT 'geral', -- 'financeiro', 'suporte', 'verificacao', 'saudacao'
  description TEXT, -- Descrição de quando usar
  variables JSONB DEFAULT '[]'::jsonb, -- Lista de variáveis suportadas ['contact_name', 'masked_cpf']
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Tabela de regras de notificação de tickets (vincula eventos a templates de email)
CREATE TABLE public.ticket_notification_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_category TEXT NOT NULL, -- 'saque', 'financeiro', 'tecnico', 'suporte'
  event_type TEXT NOT NULL, -- 'created', 'resolved', 'updated', 'assigned'
  email_template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ticket_category, event_type)
);

-- 3. RLS para ai_message_templates
ALTER TABLE public.ai_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_view_ai_message_templates"
  ON public.ai_message_templates
  FOR SELECT
  USING (true);

CREATE POLICY "admin_manager_can_insert_ai_message_templates"
  ON public.ai_message_templates
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "admin_manager_can_update_ai_message_templates"
  ON public.ai_message_templates
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "admin_manager_can_delete_ai_message_templates"
  ON public.ai_message_templates
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- 4. RLS para ticket_notification_rules
ALTER TABLE public.ticket_notification_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_view_ticket_notification_rules"
  ON public.ticket_notification_rules
  FOR SELECT
  USING (true);

CREATE POLICY "admin_manager_can_insert_ticket_notification_rules"
  ON public.ticket_notification_rules
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "admin_manager_can_update_ticket_notification_rules"
  ON public.ticket_notification_rules
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "admin_manager_can_delete_ticket_notification_rules"
  ON public.ticket_notification_rules
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- 5. Trigger para atualizar updated_at
CREATE TRIGGER update_ai_message_templates_updated_at
  BEFORE UPDATE ON public.ai_message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ticket_notification_rules_updated_at
  BEFORE UPDATE ON public.ticket_notification_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Inserir templates padrão para saque (formato estruturado)
INSERT INTO public.ai_message_templates (key, title, content, category, description, variables) VALUES 
(
  'saque_coleta_dados',
  'Coleta de Dados para Saque',
  E'Perfeito! Para processar seu saque, me envie os dados no seguinte formato:\n\n📋 **Nome completo:** [seu nome conforme cadastro]\n🔑 **Tipo da chave PIX:** [CPF / E-mail / Telefone / Chave Aleatória]\n🔐 **Chave PIX:** [sua chave completa]\n💰 **Valor:** [R$ X,XX ou \"valor total da carteira\"]\n\n⚠️ **Importante:** A chave PIX deve estar vinculada ao mesmo CPF cadastrado ({{masked_cpf}}). Não é possível transferir para conta de terceiros.',
  'financeiro',
  'Mensagem enviada após cliente confirmar dados para solicitar informações de saque',
  '["masked_cpf", "contact_name"]'::jsonb
),
(
  'saque_sucesso',
  'Confirmação de Ticket de Saque',
  E'✅ **Solicitação de saque registrada!**\n\n📋 **Protocolo:** #{{ticket_id}}\n💵 **Valor Solicitado:** R$ {{valor}}\n🔐 **CPF (final):** ...{{cpf_last4}}\n⏱️ **Prazo:** até 7 dias úteis\n\n📧 **Você receberá um email confirmando a abertura do chamado.**\n🔔 **Quando o saque for processado, você será notificado por email também.**\n\n📌 **IMPORTANTE:** O saque será creditado via PIX na chave informada, vinculada ao seu CPF. Não é possível transferir para conta de terceiros.',
  'financeiro',
  'Mensagem de confirmação após criar ticket de saque',
  '["ticket_id", "valor", "cpf_last4"]'::jsonb
),
(
  'confirmacao_dados_saque',
  'Confirmação de Dados para Saque',
  E'Vou confirmar seus dados para o saque:\n\n👤 **Nome:** {{contact_name}}\n📄 **CPF:** {{masked_cpf}}\n\n⚠️ **Regra de Segurança:** O saque só pode ser feito via PIX para uma chave vinculada a este CPF cadastrado. Não é possível enviar para conta de terceiros.\n\nOs dados estão corretos?',
  'financeiro',
  'Mensagem para confirmar dados do cliente antes de prosseguir com saque',
  '["contact_name", "masked_cpf"]'::jsonb
),
(
  'otp_enviado',
  'OTP Enviado',
  E'📧 Enviei um código de verificação para {{masked_email}}.\n\nPor favor, me informe o código de 6 dígitos que você recebeu.',
  'verificacao',
  'Mensagem após enviar código OTP por email',
  '["masked_email"]'::jsonb
),
(
  'otp_reenvio',
  'Reenvio de OTP',
  E'📧 Reenviei o código de verificação para {{masked_email}}.\n\nVerifique também sua caixa de spam. O código expira em 10 minutos.',
  'verificacao',
  'Mensagem após reenviar código OTP',
  '["masked_email"]'::jsonb
),
(
  'saudacao_cliente_conhecido',
  'Saudação Cliente Conhecido',
  E'Olá, {{contact_name}}! 👋\n\nBem-vindo(a) de volta! Como posso te ajudar hoje?',
  'saudacao',
  'Saudação para clientes já identificados',
  '["contact_name"]'::jsonb
),
(
  'saudacao_cliente_novo',
  'Saudação Cliente Novo',
  E'Olá! 👋\n\nSeja bem-vindo(a)! Como posso te ajudar hoje?',
  'saudacao',
  'Saudação para novos visitantes',
  '[]'::jsonb
);