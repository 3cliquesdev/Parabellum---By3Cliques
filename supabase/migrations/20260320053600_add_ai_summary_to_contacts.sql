-- Memória persistente entre conversas: resumo gerado por IA por contato
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS ai_summary_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.contacts.ai_summary IS 'Resumo gerado por IA das conversas anteriores do cliente. Atualizado automaticamente ao encerrar cada conversa.';
COMMENT ON COLUMN public.contacts.ai_summary_updated_at IS 'Timestamp da última atualização do ai_summary';
