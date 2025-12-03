-- Criar função RPC para busca de artigos similares (detecção de duplicatas)
CREATE OR REPLACE FUNCTION public.search_similar_articles(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.95,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ka.id,
    ka.title,
    (1 - (ka.embedding <=> query_embedding))::float as similarity
  FROM knowledge_articles ka
  WHERE ka.embedding IS NOT NULL
    AND (1 - (ka.embedding <=> query_embedding)) >= match_threshold
  ORDER BY ka.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Adicionar coluna source para rastrear origem dos artigos
ALTER TABLE public.knowledge_articles 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

-- Criar índice para melhorar performance de busca por source
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_source 
ON public.knowledge_articles(source);

-- Adicionar comentário explicativo
COMMENT ON COLUMN public.knowledge_articles.source IS 'Origem do artigo: manual, auto_mining_success, auto_mining_failure_fix';