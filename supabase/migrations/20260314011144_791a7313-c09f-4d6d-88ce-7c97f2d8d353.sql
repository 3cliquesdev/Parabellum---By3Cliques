CREATE OR REPLACE FUNCTION public.get_distinct_knowledge_categories()
RETURNS TABLE(category TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ka.category
  FROM knowledge_articles ka
  WHERE ka.category IS NOT NULL
    AND ka.category != ''
  ORDER BY ka.category;
$$;