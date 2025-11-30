-- FASE 2: Cache Inteligente para Respostas de IA
-- Cria tabela para cache de respostas com TTL de 24 horas

CREATE TABLE IF NOT EXISTS public.ai_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_hash TEXT NOT NULL,
  answer TEXT NOT NULL,
  context_ids JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para busca rápida por hash
CREATE INDEX idx_ai_response_cache_hash ON public.ai_response_cache(question_hash);

-- Índice para limpeza de registros antigos
CREATE INDEX idx_ai_response_cache_created_at ON public.ai_response_cache(created_at);

-- RLS: Apenas edge functions podem acessar (service_role)
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

-- Comentários
COMMENT ON TABLE public.ai_response_cache IS 'Cache de respostas da IA com TTL de 24 horas para latência zero em perguntas repetidas';
COMMENT ON COLUMN public.ai_response_cache.question_hash IS 'Hash SHA-256 da pergunta normalizada (lowercase, sem pontuação)';
COMMENT ON COLUMN public.ai_response_cache.answer IS 'Resposta completa da IA';
COMMENT ON COLUMN public.ai_response_cache.context_ids IS 'IDs dos artigos da base de conhecimento usados na resposta';