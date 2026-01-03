-- Remover constraint antiga de channel
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_channel_check;

-- Criar nova constraint com canais adicionais incluindo "form"
ALTER TABLE tickets ADD CONSTRAINT tickets_channel_check 
  CHECK (channel = ANY (ARRAY['platform'::text, 'email'::text, 'whatsapp'::text, 'form'::text, 'api'::text, 'chat'::text]));