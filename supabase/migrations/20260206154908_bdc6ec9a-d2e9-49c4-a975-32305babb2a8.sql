-- Tornar customer_id opcional na tabela tickets
ALTER TABLE tickets 
ALTER COLUMN customer_id DROP NOT NULL;