-- FASE 1: Merge Tickets
-- Adicionar coluna de fusão de tickets
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS merged_to_ticket_id UUID REFERENCES public.tickets(id);

-- Índice para performance de consultas de tickets mesclados
CREATE INDEX IF NOT EXISTS idx_tickets_merged_to ON public.tickets(merged_to_ticket_id);

-- FASE 2: Email Channel Integration
-- Adicionar suporte a canal de comunicação e threading de emails
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS channel TEXT DEFAULT 'platform' CHECK (channel IN ('platform', 'email', 'whatsapp')),
ADD COLUMN IF NOT EXISTS last_email_message_id TEXT;

-- Índice para filtrar tickets por canal
CREATE INDEX IF NOT EXISTS idx_tickets_channel ON public.tickets(channel);

-- Comentários explicativos
COMMENT ON COLUMN public.tickets.merged_to_ticket_id IS 'ID do ticket principal quando este ticket foi mesclado';
COMMENT ON COLUMN public.tickets.channel IS 'Canal de origem do ticket: platform (sistema), email (inbound), whatsapp';
COMMENT ON COLUMN public.tickets.last_email_message_id IS 'Message-ID do último email para threading (In-Reply-To header)';