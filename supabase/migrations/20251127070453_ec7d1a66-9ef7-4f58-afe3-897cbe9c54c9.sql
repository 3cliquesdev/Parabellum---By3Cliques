-- FASE 4: Limpeza de Dados Existentes
-- 🧹 Limpar contacts.phone que contém sufixos JID (@lid, @s.whatsapp.net)

-- 1. Atualizar phone para remover todos os sufixos JID
UPDATE contacts
SET phone = REGEXP_REPLACE(
  REGEXP_REPLACE(
    REGEXP_REPLACE(
      REGEXP_REPLACE(phone, '@s\.whatsapp\.net$', '', 'i'),
      '@lid$', '', 'i'
    ),
    '@g\.us$', '', 'i'
  ),
  '@c\.us$', '', 'i'
)
WHERE phone LIKE '%@%';

-- 2. Normalizar números brasileiros (adicionar 55 se tiver 10 ou 11 dígitos)
UPDATE contacts
SET phone = '55' || phone
WHERE LENGTH(phone) IN (10, 11)
  AND phone NOT LIKE '55%'
  AND phone ~ '^\d+$';

-- 3. Criar índice para performance em queries por whatsapp_id
CREATE INDEX IF NOT EXISTS idx_contacts_whatsapp_id 
ON contacts(whatsapp_id) 
WHERE whatsapp_id IS NOT NULL;