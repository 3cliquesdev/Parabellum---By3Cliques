-- Correção 1: Remover FK constraint do template_id que está causando erros
ALTER TABLE public.email_sends
DROP CONSTRAINT IF EXISTS email_sends_template_id_fkey;

-- Correção 2: Índice de performance para queries de deals (sem CONCURRENTLY)
CREATE INDEX IF NOT EXISTS idx_deals_performance 
ON public.deals(pipeline_id, status, assigned_to, created_at DESC)
WHERE status = 'open';