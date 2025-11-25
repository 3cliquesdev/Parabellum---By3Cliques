-- FASE 1: Database Webhook para Autopilot
-- Criar função que será chamada via Database Webhook do Supabase

-- Como não temos net.http_post nativo, vamos usar Database Webhook
-- configurado no Supabase Dashboard que chama message-listener Edge Function

-- Adicionar comentário indicando necessidade de configurar webhook manualmente
COMMENT ON TABLE messages IS 'Configure Database Webhook: ON INSERT -> POST to message-listener function';

-- Garantir que novas conversas começam em autopilot por padrão
ALTER TABLE conversations 
ALTER COLUMN ai_mode SET DEFAULT 'autopilot';