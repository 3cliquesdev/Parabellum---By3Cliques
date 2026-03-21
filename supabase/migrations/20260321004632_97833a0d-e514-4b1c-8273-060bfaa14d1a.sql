ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.contacts.ai_summary IS 'Resumo gerado por IA das conversas anteriores do cliente';
COMMENT ON COLUMN public.contacts.ai_summary_updated_at IS 'Última atualização do ai_summary';