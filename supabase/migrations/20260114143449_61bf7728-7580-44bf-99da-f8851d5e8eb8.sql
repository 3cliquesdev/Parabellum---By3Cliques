-- Criar template de saudação para clientes identificados pela base de contatos
INSERT INTO ai_message_templates (key, title, content, description, category, is_active, variables)
VALUES (
  'saudacao_cliente_base',
  'Saudação Cliente da Base',
  'Olá, {{contact_name}}! 👋

Que bom ter você de volta! Como posso te ajudar hoje?',
  'Saudação para clientes identificados pela base de contatos (status = customer)',
  'saudacao',
  true,
  '["contact_name"]'::jsonb
)
ON CONFLICT (key) DO NOTHING;