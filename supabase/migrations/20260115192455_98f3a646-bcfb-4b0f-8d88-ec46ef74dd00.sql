-- Adicionar coluna de anexos em ticket_comments
ALTER TABLE public.ticket_comments
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ticket_comments.attachments IS 'Anexos do comentário (formato: [{url, name, type, size}])';