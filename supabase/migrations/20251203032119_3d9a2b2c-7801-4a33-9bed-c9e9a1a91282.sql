
-- FASE 2 FINAL: Corrigir últimas 3 funções sem search_path

-- 1. match_knowledge_articles
CREATE OR REPLACE FUNCTION public.match_knowledge_articles(
  query_embedding vector, 
  match_threshold double precision DEFAULT 0.75, 
  match_count integer DEFAULT 5
)
RETURNS TABLE(id uuid, title text, content text, category text, similarity double precision)
LANGUAGE sql
STABLE
SET search_path = public
AS $function$
  SELECT 
    id,
    title,
    content,
    category,
    1 - (embedding <=> query_embedding) AS similarity
  FROM public.knowledge_articles
  WHERE 
    is_published = true
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> query_embedding) > match_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$function$;

-- 2. update_article_embedding
CREATE OR REPLACE FUNCTION public.update_article_embedding(article_id uuid, new_embedding vector)
RETURNS void
LANGUAGE sql
SET search_path = public
AS $function$
  UPDATE public.knowledge_articles
  SET embedding = new_embedding
  WHERE id = article_id;
$function$;

-- 3. update_system_configurations_updated_at
CREATE OR REPLACE FUNCTION public.update_system_configurations_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$function$;
