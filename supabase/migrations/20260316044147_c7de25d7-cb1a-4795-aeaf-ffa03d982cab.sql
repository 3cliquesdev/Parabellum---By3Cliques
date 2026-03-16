
-- Etapa 1: Adicionar coluna product_tags na tabela knowledge_articles
ALTER TABLE public.knowledge_articles 
ADD COLUMN IF NOT EXISTS product_tags text[] NOT NULL DEFAULT '{}';

-- Etapa 2: Recriar a função match_knowledge_articles com suporte a product_filter
CREATE OR REPLACE FUNCTION public.match_knowledge_articles(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  product_filter text[] DEFAULT '{}'
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  category text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ka.id,
    ka.title,
    ka.content,
    ka.category,
    (1 - (ka.embedding <=> query_embedding))::float AS similarity
  FROM public.knowledge_articles ka
  WHERE 
    ka.is_published = true
    AND ka.embedding IS NOT NULL
    AND 1 - (ka.embedding <=> query_embedding) > match_threshold
    AND (
      -- Se product_filter está vazio, retorna todos os artigos
      array_length(product_filter, 1) IS NULL
      -- Se product_filter tem valores, retorna artigos que:
      -- 1. Tenham pelo menos uma tag em comum (específicos do produto)
      -- 2. OU não tenham tags (artigos genéricos, aplicáveis a todos)
      OR ka.product_tags = '{}'
      OR ka.product_tags && product_filter
    )
  ORDER BY ka.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
