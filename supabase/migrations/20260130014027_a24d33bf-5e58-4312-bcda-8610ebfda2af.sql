-- Add is_test_mode column to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS is_test_mode BOOLEAN DEFAULT FALSE;

-- Add comment explaining the purpose
COMMENT ON COLUMN conversations.is_test_mode IS 
'Quando true, ignora ai_global_enabled e processa IA normalmente. Usado para testes individuais sem afetar produção.';