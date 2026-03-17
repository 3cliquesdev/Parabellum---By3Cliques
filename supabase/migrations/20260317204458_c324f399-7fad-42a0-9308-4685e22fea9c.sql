
CREATE OR REPLACE FUNCTION public.match_knowledge_articles(
  query_embedding vector,
  match_threshold double precision DEFAULT 0.75,
  match_count integer DEFAULT 5,
  product_filter text[] DEFAULT '{}'::text[]
)
RETURNS TABLE(id uuid, title text, content text, category text, similarity double precision)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT 
    ka.id,
    ka.title,
    ka.content,
    ka.category,
    1 - (ka.embedding <=> query_embedding) AS similarity
  FROM public.knowledge_articles ka
  WHERE 
    ka.is_published = true
    AND ka.embedding IS NOT NULL
    AND 1 - (ka.embedding <=> query_embedding) > match_threshold
    AND (
      -- Se product_filter está vazio, retorna todos os artigos
      array_length(product_filter, 1) IS NULL
      OR
      -- Artigos genéricos (sem product_tags) sempre retornam
      ka.product_tags = '{}'::text[]
      OR ka.product_tags IS NULL
      OR
      -- Artigos que possuem pelo menos uma tag correspondente ao filtro
      ka.product_tags && product_filter
    )
  ORDER BY ka.embedding <=> query_embedding
  LIMIT match_count;
$function$;
