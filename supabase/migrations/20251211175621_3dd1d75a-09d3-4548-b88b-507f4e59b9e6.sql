-- Adicionar coluna inbox_enabled para controlar recebimento de mensagens no Inbox
ALTER TABLE public.whatsapp_instances 
ADD COLUMN inbox_enabled BOOLEAN DEFAULT TRUE;

-- Comentário explicativo
COMMENT ON COLUMN public.whatsapp_instances.inbox_enabled IS 
'Se TRUE, mensagens recebidas aparecem no Inbox. Se FALSE, a instância é usada apenas para envio.';