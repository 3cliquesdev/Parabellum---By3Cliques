-- 1. Atualizar lead_source para 'formulario' em deals existentes de formulários
UPDATE deals 
SET lead_source = 'formulario', updated_at = NOW()
WHERE lead_source IS NULL
  AND (
    title ILIKE 'Lead via %'
    OR title ILIKE 'Lead via Formulário%'
    OR title ILIKE 'Lead via Página%'
  );

-- 2. Também atualizar deals com lead_source='form' para 'formulario' (padronização)
UPDATE deals 
SET lead_source = 'formulario', updated_at = NOW()
WHERE lead_source = 'form';

-- 3. Identificar e marcar duplicados como lost (mantendo o mais antigo)
WITH duplicates AS (
  SELECT d.id, d.contact_id, d.created_at,
    ROW_NUMBER() OVER (PARTITION BY c.email, d.pipeline_id ORDER BY d.created_at ASC) as rn
  FROM deals d
  JOIN contacts c ON d.contact_id = c.id
  WHERE d.status = 'open'
    AND c.email IS NOT NULL
)
UPDATE deals 
SET status = 'lost', 
    lost_reason = 'Duplicado - Merged automaticamente',
    updated_at = NOW()
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);