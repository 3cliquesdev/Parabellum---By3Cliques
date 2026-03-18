CREATE OR REPLACE FUNCTION public.update_article_embedding(article_id uuid, new_embedding vector)
RETURNS void
LANGUAGE sql
SET search_path TO 'public'
AS $$
  UPDATE public.knowledge_articles
  SET embedding = new_embedding,
      embedding_generated = true
  WHERE id = article_id;
$$;