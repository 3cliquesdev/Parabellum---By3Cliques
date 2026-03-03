
-- Opção A: Atualizar kb_categories do nó ia_entrada no Master Flow
-- para incluir TODAS as categorias existentes na base de conhecimento
UPDATE chat_flows
SET flow_definition = jsonb_set(
  flow_definition,
  '{nodes}',
  (
    SELECT jsonb_agg(
      CASE 
        WHEN node->>'id' = 'ia_entrada' 
        THEN jsonb_set(
          node, 
          '{data,kb_categories}', 
          '["Cancelamento","Importado","Manual da 3 Cliques","Produto","Suporte","Treinamento IA"]'::jsonb
        )
        ELSE node
      END
    )
    FROM jsonb_array_elements(flow_definition->'nodes') AS node
  )
),
updated_at = now()
WHERE is_master_flow = true;
