-- Adicionar coluna data_access para controlar o que cada persona tem acesso
ALTER TABLE ai_personas ADD COLUMN IF NOT EXISTS data_access JSONB DEFAULT '{
  "customer_data": true,
  "knowledge_base": true,
  "order_history": false,
  "financial_data": false
}'::jsonb;

COMMENT ON COLUMN ai_personas.data_access IS 'Controls what data the AI persona can access: customer_data (name, email, phone, CPF), knowledge_base (articles), order_history (purchase history), financial_data (balance, transactions)';