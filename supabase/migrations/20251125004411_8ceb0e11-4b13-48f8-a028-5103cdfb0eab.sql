-- FASE 1: Integração Enterprise Inbox-to-Ticket
-- =============================================

-- 1A - Criar ENUM de categoria
CREATE TYPE ticket_category AS ENUM ('financeiro', 'tecnico', 'bug', 'outro');

-- 1B - Expandir tabela TICKETS
ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS source_conversation_id UUID 
    REFERENCES public.conversations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category ticket_category DEFAULT 'outro',
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS internal_note TEXT;

-- Índices para performance em tickets
CREATE INDEX IF NOT EXISTS idx_tickets_source_conversation 
  ON public.tickets(source_conversation_id);
CREATE INDEX IF NOT EXISTS idx_tickets_due_date 
  ON public.tickets(due_date) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX IF NOT EXISTS idx_tickets_category 
  ON public.tickets(category);

-- 1C - Expandir tabela CONVERSATIONS
ALTER TABLE public.conversations 
  ADD COLUMN IF NOT EXISTS related_ticket_id UUID 
    REFERENCES public.tickets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_conversations_related_ticket 
  ON public.conversations(related_ticket_id);

-- 1D - Expandir tabela MESSAGES
ALTER TABLE public.messages 
  ADD COLUMN IF NOT EXISTS attachment_url TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_with_attachments 
  ON public.messages(conversation_id) 
  WHERE attachment_url IS NOT NULL;

-- 1E - Comentários para documentação
COMMENT ON COLUMN tickets.source_conversation_id IS 
  'Link bidirecional: de qual conversa do Inbox este ticket foi criado';
COMMENT ON COLUMN tickets.category IS 
  'Categoria para roteamento inteligente: financeiro, técnico, bug ou outro';
COMMENT ON COLUMN tickets.due_date IS 
  'Prazo SLA baseado na prioridade (urgente: +4h, normal: +24h)';
COMMENT ON COLUMN tickets.internal_note IS 
  'Nota interna visível apenas para equipe (campo amarelo no modal)';
COMMENT ON COLUMN conversations.related_ticket_id IS 
  'Link reverso: se esta conversa gerou um ticket, qual é?';
COMMENT ON COLUMN messages.attachment_url IS 
  'URL do anexo (foto do WhatsApp, PDF, etc) que deve ir para o ticket';
COMMENT ON COLUMN messages.attachment_type IS 
  'MIME type do anexo (ex: image/jpeg, application/pdf)';