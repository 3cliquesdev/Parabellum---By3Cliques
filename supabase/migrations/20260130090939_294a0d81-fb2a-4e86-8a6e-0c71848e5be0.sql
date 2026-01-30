-- Adicionar 'away' ao enum availability_status
ALTER TYPE availability_status ADD VALUE 'away' AFTER 'busy';