-- Adicionar novos valores ao ENUM ticket_status
-- Estes valores existem na tabela ticket_statuses mas não no tipo ENUM
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'returned';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'loja_bloqueada';
ALTER TYPE ticket_status ADD VALUE IF NOT EXISTS 'loja_concluida';