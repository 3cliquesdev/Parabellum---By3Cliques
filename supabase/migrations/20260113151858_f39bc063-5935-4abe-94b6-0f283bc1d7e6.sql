-- Adicionar valores faltantes ao ENUM ticket_category
-- Esses valores existem na tabela ticket_categories mas não no ENUM
ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'duvida';
ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'problema_tecnico';
ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'sugestao';
ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'reclamacao';
ALTER TYPE ticket_category ADD VALUE IF NOT EXISTS 'saque';