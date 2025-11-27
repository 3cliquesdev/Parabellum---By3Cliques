-- FASE 1: Vincular Conversa à Instância WhatsApp
-- Adicionar referência para saber de qual instância veio a conversa
ALTER TABLE public.conversations 
ADD COLUMN whatsapp_instance_id UUID REFERENCES whatsapp_instances(id);

-- Índice para buscas rápidas
CREATE INDEX idx_conversations_whatsapp_instance 
ON conversations(whatsapp_instance_id) 
WHERE whatsapp_instance_id IS NOT NULL;

-- Comentário explicativo
COMMENT ON COLUMN conversations.whatsapp_instance_id IS 'Instância WhatsApp pela qual a conversa foi iniciada. Usado para roteamento de mensagens de saída.';