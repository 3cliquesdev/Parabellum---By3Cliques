-- Corrigir switches órfãos no V5 Enterprise
-- 1. Remover enable_saque do node_ia_financeiro
-- 2. Remover enable_suporte do node_ia_pedidos e node_ia_duvidas
DO $$
DECLARE
  flow_record RECORD;
  flow_def JSONB;
  nodes JSONB;
  updated_nodes JSONB := '[]'::JSONB;
  node JSONB;
  node_data JSONB;
  node_id TEXT;
BEGIN
  SELECT id, flow_definition INTO flow_record
  FROM chat_flows 
  WHERE id = 'cafe2831-2dba-47dc-a0f6-a502eb685410';

  flow_def := flow_record.flow_definition;
  nodes := flow_def->'nodes';

  FOR i IN 0..jsonb_array_length(nodes) - 1 LOOP
    node := nodes->i;
    node_id := node->>'id';
    node_data := node->'data';

    -- Remove enable_saque from financeiro
    IF node_id = 'node_ia_financeiro' AND node_data ? 'enable_saque' THEN
      node_data := node_data - 'enable_saque';
      node := jsonb_set(node, '{data}', node_data);
    END IF;

    -- Remove enable_suporte from pedidos
    IF node_id = 'node_ia_pedidos' AND node_data ? 'enable_suporte' THEN
      node_data := node_data - 'enable_suporte';
      node := jsonb_set(node, '{data}', node_data);
    END IF;

    -- Remove enable_suporte from duvidas
    IF node_id = 'node_ia_duvidas' AND node_data ? 'enable_suporte' THEN
      node_data := node_data - 'enable_suporte';
      node := jsonb_set(node, '{data}', node_data);
    END IF;

    updated_nodes := updated_nodes || jsonb_build_array(node);
  END LOOP;

  flow_def := jsonb_set(flow_def, '{nodes}', updated_nodes);

  UPDATE chat_flows
  SET flow_definition = flow_def, updated_at = now()
  WHERE id = 'cafe2831-2dba-47dc-a0f6-a502eb685410';
END $$;