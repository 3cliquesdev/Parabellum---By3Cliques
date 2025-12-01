-- Criar tag "Inadimplente" para identificar clientes com reembolso/chargeback
INSERT INTO tags (name, color, category) 
VALUES ('Inadimplente', '#DC2626', 'status')
ON CONFLICT (name) DO NOTHING;