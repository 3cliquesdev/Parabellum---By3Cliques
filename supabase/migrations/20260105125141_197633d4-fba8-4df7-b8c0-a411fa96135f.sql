-- Adicionar webhook inbound separado
INSERT INTO system_configurations (key, value, description, category)
VALUES (
  'email_inbound_webhook_url',
  'https://zaeozfdjhrmblfaxsyuu.supabase.co/functions/v1/inbound-email',
  'URL do webhook para respostas de email (Resend)',
  'webhook'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description;

-- Atualizar descrição do webhook de tracking
UPDATE system_configurations 
SET description = 'URL do webhook para tracking de email (Resend)'
WHERE key = 'email_webhook_url';