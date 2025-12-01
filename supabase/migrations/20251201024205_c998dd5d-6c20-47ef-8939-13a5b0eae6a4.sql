-- Adicionar campo source na tabela knowledge_articles para rastreio de origem
ALTER TABLE knowledge_articles ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Adicionar índice para facilitar filtragem por source
CREATE INDEX IF NOT EXISTS idx_knowledge_articles_source ON knowledge_articles(source);

-- Adicionar campo status para controlar aprovação (draft/published)
-- Verificar se já existe antes de adicionar
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'knowledge_articles' AND column_name = 'status'
  ) THEN
    ALTER TABLE knowledge_articles ADD COLUMN status TEXT DEFAULT 'published';
    CREATE INDEX idx_knowledge_articles_status ON knowledge_articles(status);
  END IF;
END $$;

COMMENT ON COLUMN knowledge_articles.source IS 'Origem do artigo: manual, sandbox_training, passive_learning, human_correction';
COMMENT ON COLUMN knowledge_articles.status IS 'Status do artigo: draft (rascunho), published (publicado)';