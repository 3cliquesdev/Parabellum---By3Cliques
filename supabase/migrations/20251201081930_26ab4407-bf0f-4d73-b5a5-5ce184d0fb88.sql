-- Adicionar colunas para rastrear clientes inadimplentes e tags adicionadas
ALTER TABLE sync_jobs 
ADD COLUMN IF NOT EXISTS customers_churned INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags_added INTEGER DEFAULT 0;