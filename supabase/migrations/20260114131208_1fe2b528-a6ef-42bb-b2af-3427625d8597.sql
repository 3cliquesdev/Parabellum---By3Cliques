-- Adicionar campos para rastreamento de validação Kiwify
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS kiwify_validated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS kiwify_validated_at TIMESTAMPTZ;

-- Índice para buscar contatos validados pela Kiwify
CREATE INDEX IF NOT EXISTS idx_contacts_kiwify_validated 
ON contacts(kiwify_validated) 
WHERE kiwify_validated = TRUE;

-- Comentário para documentação
COMMENT ON COLUMN contacts.kiwify_validated IS 'Indica se o contato foi identificado automaticamente via número de compra Kiwify';
COMMENT ON COLUMN contacts.kiwify_validated_at IS 'Data/hora da validação automática via Kiwify';