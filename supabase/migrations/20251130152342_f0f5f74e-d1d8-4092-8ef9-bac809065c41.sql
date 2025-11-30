-- FASE 3: Embeddings Semânticos para Busca Vetorial Precisa
-- Habilita extensão pgvector para busca por similaridade

-- 1. Habilitar extensão pgvector
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;

-- 2. Adicionar coluna embedding na tabela knowledge_articles
ALTER TABLE public.knowledge_articles 
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- 3. Criar índice HNSW para busca vetorial eficiente (cosine distance)
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_embedding 
ON public.knowledge_articles 
USING hnsw (embedding vector_cosine_ops);

-- 4. Criar função de busca por similaridade semântica
CREATE OR REPLACE FUNCTION public.match_knowledge_articles(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.75,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  title text,
  content text,
  category text,
  similarity float
)
LANGUAGE sql STABLE
AS $$
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
$$;

-- Comentários
COMMENT ON COLUMN public.knowledge_articles.embedding IS 'Vector embedding (1536 dimensões) do conteúdo do artigo gerado via text-embedding-3-small da OpenAI';
COMMENT ON FUNCTION public.match_knowledge_articles IS 'Busca artigos por similaridade semântica usando cosine distance. Retorna apenas artigos publicados com similarity > threshold';

-- 5. Criar função auxiliar para atualizar embeddings em lote
CREATE OR REPLACE FUNCTION public.update_article_embedding(
  article_id uuid,
  new_embedding vector(1536)
)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.knowledge_articles
  SET embedding = new_embedding
  WHERE id = article_id;
$$;