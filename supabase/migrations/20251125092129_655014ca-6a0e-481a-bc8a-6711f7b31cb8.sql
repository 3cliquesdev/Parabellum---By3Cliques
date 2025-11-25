-- =====================================================
-- MIGRAÇÃO ROBUSTA: ai_routing_rules.department ENUM → UUID
-- =====================================================

-- PASSO 1: Adicionar coluna temporária UUID
ALTER TABLE ai_routing_rules 
ADD COLUMN department_uuid UUID;

-- PASSO 2: Migrar dados existentes mapeando ENUM para UUID
UPDATE ai_routing_rules 
SET department_uuid = 
  CASE department::text
    WHEN 'comercial' THEN 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c'::uuid
    WHEN 'suporte' THEN '36ce66cd-7414-4fc8-bd4a-268fecc3f01a'::uuid
    WHEN 'marketing' THEN '712b5b8d-521c-4fb3-a8e3-e32e90ff098a'::uuid
    WHEN 'operacional' THEN 'fcba332e-d8d6-4db3-acc1-8b5fab6941be'::uuid
    ELSE NULL
  END;

-- PASSO 3: Remover coluna antiga ENUM
ALTER TABLE ai_routing_rules DROP COLUMN department;

-- PASSO 4: Renomear nova coluna para department
ALTER TABLE ai_routing_rules RENAME COLUMN department_uuid TO department;

-- PASSO 5: Adicionar Foreign Key para departments
ALTER TABLE ai_routing_rules
ADD CONSTRAINT fk_routing_rules_department 
FOREIGN KEY (department) REFERENCES departments(id) ON DELETE SET NULL;

-- PASSO 6: Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_routing_rules_department ON ai_routing_rules(department);