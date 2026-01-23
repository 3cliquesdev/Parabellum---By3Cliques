-- =============================================
-- Fluxo de Triagem Inteligente: Menu de Departamentos
-- =============================================

-- 1. Criar departamentos de suporte especializados
INSERT INTO public.departments (name, color, description, is_active)
VALUES 
  ('Suporte Pedidos', '#f97316', 'Atendimento relacionado a pedidos, entregas e rastreamento', true),
  ('Suporte Sistema', '#3b82f6', 'Suporte técnico, problemas no sistema e dúvidas de uso', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Criar templates de mensagem para o fluxo de triagem
INSERT INTO public.ai_message_templates (key, title, content, category, description, is_active, variables)
VALUES 
  (
    'menu_suporte_cliente', 
    'Menu de Suporte - Cliente Identificado',
    E'Olá, {{contact_name}}! 👋 Que bom ter você de volta!\n\nComo posso te ajudar hoje?\n\n**1** - Pedidos (entregas, rastreio, trocas)\n**2** - Sistema (acesso, dúvidas técnicas)',
    'triage',
    'Menu exibido para clientes já identificados escolherem o departamento',
    true,
    '["contact_name"]'::jsonb
  ),
  (
    'lead_direcionado_comercial', 
    'Lead Direcionado para Comercial',
    'Obrigado! Como você ainda não é nosso cliente, vou te direcionar para nosso time Comercial que poderá te ajudar. 🤝\n\nAguarde um momento que logo um de nossos consultores irá te atender!',
    'triage',
    'Mensagem enviada quando lead não encontrado no banco é direcionado ao comercial',
    true,
    '[]'::jsonb
  ),
  (
    'confirmacao_email_encontrado', 
    'Email Encontrado - Exibir Menu',
    E'Encontrei seu cadastro, {{contact_name}}! 🎉\n\nAgora me diz: precisa de ajuda com:\n**1** - Pedidos\n**2** - Sistema',
    'triage',
    'Mensagem após verificar email no banco (sem OTP)',
    true,
    '["contact_name"]'::jsonb
  ),
  (
    'aguardando_escolha_departamento',
    'Aguardando Escolha de Departamento',
    'Por favor, escolha uma das opções:\n\n**1** - Pedidos (entregas, rastreio, trocas)\n**2** - Sistema (acesso, dúvidas técnicas)',
    'triage',
    'Lembrete quando cliente não escolhe opção válida',
    true,
    '[]'::jsonb
  ),
  (
    'direcionado_suporte_pedidos',
    'Direcionado para Suporte Pedidos',
    'Entendi! Estou te direcionando para o time de **Suporte de Pedidos**. 📦\n\nComo posso ajudar com seu pedido?',
    'triage',
    'Confirmação de roteamento para Suporte Pedidos',
    true,
    '[]'::jsonb
  ),
  (
    'direcionado_suporte_sistema',
    'Direcionado para Suporte Sistema',
    'Entendi! Estou te direcionando para o time de **Suporte Técnico**. 💻\n\nQual é sua dúvida ou problema?',
    'triage',
    'Confirmação de roteamento para Suporte Sistema',
    true,
    '[]'::jsonb
  )
ON CONFLICT (key) DO UPDATE SET 
  content = EXCLUDED.content, 
  title = EXCLUDED.title,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  is_active = true,
  variables = EXCLUDED.variables;

-- 3. Criar tool para roteamento de departamento
INSERT INTO public.ai_tools (name, description, function_schema, is_enabled, requires_auth)
VALUES (
  'route_to_department',
  'Roteia a conversa para um departamento específico quando cliente escolhe entre opções do menu',
  '{
    "name": "route_to_department",
    "description": "Use quando cliente escolher entre departamentos (pedidos/sistema) através do menu. NÃO use para transferir para humano - use request_human_agent para isso.",
    "parameters": {
      "type": "object",
      "properties": {
        "department": {
          "type": "string",
          "enum": ["suporte_pedidos", "suporte_sistema"],
          "description": "Departamento escolhido pelo cliente"
        },
        "reason": {
          "type": "string",
          "description": "Motivo da escolha baseado no que o cliente disse"
        }
      },
      "required": ["department"]
    }
  }'::jsonb,
  true,
  false
)
ON CONFLICT (name) DO UPDATE SET 
  description = EXCLUDED.description,
  function_schema = EXCLUDED.function_schema,
  is_enabled = true;