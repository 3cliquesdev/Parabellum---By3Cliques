ALTER TABLE departments ADD COLUMN ai_auto_close_minutes integer DEFAULT NULL;

COMMENT ON COLUMN departments.ai_auto_close_minutes IS 'Minutos de inatividade do cliente para encerrar conversa com IA automaticamente. NULL = não encerrar.';