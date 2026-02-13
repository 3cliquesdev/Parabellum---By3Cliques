ALTER TABLE forms 
  ADD COLUMN IF NOT EXISTS routing_field_id TEXT,
  ADD COLUMN IF NOT EXISTS routing_field_mappings JSONB DEFAULT '{}';

COMMENT ON COLUMN forms.routing_field_id IS 'ID do campo select usado para roteamento condicional';
COMMENT ON COLUMN forms.routing_field_mappings IS 'Mapeamento opcao->user_id para distribuicao field_based';