-- FASE 1: Adicionar colunas para valor bruto/líquido nos deals
ALTER TABLE deals 
ADD COLUMN IF NOT EXISTS gross_value DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS net_value DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS kiwify_fee DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS affiliate_commission DECIMAL(10,2);

-- FASE 2: Deletar deals duplicados ANTES de criar constraint
-- Manter apenas o mais antigo por contact_id
WITH oldest AS (
  SELECT DISTINCT ON (contact_id) id, contact_id
  FROM deals 
  WHERE title LIKE 'Recuperação%' AND status = 'open'
  ORDER BY contact_id, created_at ASC
)
DELETE FROM deals 
WHERE title LIKE 'Recuperação%' 
  AND status = 'open'
  AND id NOT IN (SELECT id FROM oldest);

-- FASE 3: Agora criar índice único parcial para prevenir duplicados futuros
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_recovery_deal_per_contact 
ON deals (contact_id) 
WHERE status = 'open' AND title ILIKE '%Recuperação%';

-- FASE 4: Atualizar telefone do ADRIANO (a.cersosimo@gmail.com)
UPDATE contacts 
SET phone = '+5511993055003'
WHERE email = 'a.cersosimo@gmail.com' AND phone IS NULL;

-- FASE 5: Atualizar deal do ADRIANO com valores corretos (baseado nos logs)
UPDATE deals 
SET 
  value = 136.67,           -- Valor líquido
  gross_value = 197.00,     -- Valor bruto
  net_value = 136.67,       -- Valor líquido
  kiwify_fee = 14.29        -- Taxa Kiwify
WHERE contact_id = (SELECT id FROM contacts WHERE email = 'a.cersosimo@gmail.com')
  AND title LIKE 'Recuperação%'
  AND status = 'open';