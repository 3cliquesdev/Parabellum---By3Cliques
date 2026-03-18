CREATE OR REPLACE FUNCTION public.get_distinct_product_tags()
RETURNS TABLE(product_tag text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT unnest(product_tags) AS product_tag
  FROM knowledge_articles
  WHERE product_tags IS NOT NULL AND array_length(product_tags, 1) > 0
  ORDER BY product_tag;
$$;