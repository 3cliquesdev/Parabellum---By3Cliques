-- Corrigir dados existentes: clientes Kiwify validados que ainda estão como 'lead'
UPDATE contacts
SET status = 'customer'
WHERE kiwify_validated = true AND status != 'customer';

-- Mover conversas de clientes validados para Suporte
UPDATE conversations
SET department = '36ce66cd-7414-4fc8-bd4a-268fecc3f01a'
WHERE contact_id IN (
  SELECT id FROM contacts 
  WHERE kiwify_validated = true OR status = 'customer'
)
AND department != '36ce66cd-7414-4fc8-bd4a-268fecc3f01a';