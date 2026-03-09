
DO $$
DECLARE
  v_flow jsonb;
  v_nodes jsonb;
  v_edges jsonb;
  v_updated_nodes jsonb := '[]'::jsonb;
  v_updated_edges jsonb := '[]'::jsonb;
  v_node jsonb;
  v_edge jsonb;
  i int;
  v_ia_x float;
  v_ia_y float;
BEGIN
  SELECT flow_definition::jsonb INTO v_flow
  FROM public.chat_flows
  WHERE id = 'e44da799-c404-4c86-abe0-4aea2ca0ea1f';

  v_nodes := v_flow->'nodes';
  v_edges := v_flow->'edges';

  FOR i IN 0..jsonb_array_length(v_nodes)-1 LOOP
    v_node := v_nodes->i;
    IF v_node->>'id' = 'ia_entrada' THEN
      v_ia_x := (v_node->'position'->>'x')::float;
      v_ia_y := (v_node->'position'->>'y')::float;
      v_node := jsonb_set(v_node, '{data,exit_keywords}',
        '["atendente","humano","transferir","falar com alguem","menu","opcoes","consultor","meu consultor","falar com consultor","pessoa","falar com alguém","quero um","atendentes"]'::jsonb);
      v_node := jsonb_set(v_node, '{data,objective}',
        to_jsonb(
          (v_node->'data'->>'objective') || E'\n\n--- DETECÇÃO DE INTENÇÃO ---\nQuando o cliente mencionar saque, reembolso, saldo, pix, retirada ou estorno:\n- Responda: "Para solicitar isso com segurança, vou precisar verificar sua identidade. Me passa um segundo! 🔐"\n- Finalize sua resposta com a tag: [INTENT:financeiro]\n\nQuando o cliente quiser cancelar, encerrar ou desativar a conta:\n- Responda: "Sinto muito ouvir isso! Me conta o que está acontecendo?"\n- Se confirmar que quer cancelar, finalize com: [INTENT:cancelamento]'
        ));
      v_node := v_node #- '{data,forbid_financial}';
    END IF;
    v_updated_nodes := v_updated_nodes || jsonb_build_array(v_node);
  END LOOP;

  v_updated_nodes := v_updated_nodes || jsonb_build_array(
    jsonb_build_object(
      'id', 'intent_router', 'type', 'condition',
      'position', jsonb_build_object('x', v_ia_x + 200, 'y', v_ia_y + 250),
      'positionAbsolute', jsonb_build_object('x', v_ia_x + 200, 'y', v_ia_y + 250),
      'data', jsonb_build_object(
        'label', '🎯 Roteamento de Intenção', 'condition_type', 'equals',
        'condition_rules', jsonb_build_array(
          jsonb_build_object('id', 'rule_intent_fin', 'label', '💰 Financeiro', 'keywords', 'financeiro', 'field', 'ai_exit_intent', 'check_type', 'equals'),
          jsonb_build_object('id', 'rule_intent_canc', 'label', '🔴 Cancelamento', 'keywords', 'cancelamento', 'field', 'ai_exit_intent', 'check_type', 'equals')
        )
      ),
      'selected', false, 'dragging', false, 'width', 280, 'height', 180
    ),
    jsonb_build_object(
      'id', 'transfer_to_fin', 'type', 'transfer',
      'position', jsonb_build_object('x', v_ia_x + 600, 'y', v_ia_y + 150),
      'positionAbsolute', jsonb_build_object('x', v_ia_x + 600, 'y', v_ia_y + 150),
      'data', jsonb_build_object(
        'label', '💰 Flow Financeiro', 'message', '',
        'transfer_type', 'department', 'department_id', 'af3c75a9-cc78-4977-a1bd-0267e3809455',
        'department_name', 'Financeiro', 'target_flow_id', '4dd5a204-a3c5-4583-98b6-d4084aba359a'
      ),
      'selected', false, 'dragging', false, 'width', 260, 'height', 100
    ),
    jsonb_build_object(
      'id', 'transfer_to_canc', 'type', 'transfer',
      'position', jsonb_build_object('x', v_ia_x + 600, 'y', v_ia_y + 400),
      'positionAbsolute', jsonb_build_object('x', v_ia_x + 600, 'y', v_ia_y + 400),
      'data', jsonb_build_object(
        'label', '🔴 Flow Cancelamento', 'message', '',
        'transfer_type', 'department', 'department_id', 'b7149bf4-1356-4ca5-bc9a-8caacf7b6e80',
        'department_name', 'Customer Success', 'target_flow_id', 'b046af6b-f0b8-463f-b945-ca305bcac53e'
      ),
      'selected', false, 'dragging', false, 'width', 260, 'height', 100
    )
  );

  FOR i IN 0..jsonb_array_length(v_edges)-1 LOOP
    v_edge := v_edges->i;
    IF v_edge->>'id' = 'reactflow__edge-ia_entrada-1772133662928' THEN
      CONTINUE;
    END IF;
    v_updated_edges := v_updated_edges || jsonb_build_array(v_edge);
  END LOOP;

  v_updated_edges := v_updated_edges || jsonb_build_array(
    jsonb_build_object('id', 'reactflow__edge-ia_entrada-intent_router', 'type', 'buttonEdge',
      'source', 'ia_entrada', 'target', 'intent_router', 'sourceHandle', NULL,
      'animated', false, 'markerEnd', jsonb_build_object('type', 'arrowclosed'),
      'style', jsonb_build_object('strokeWidth', 2)),
    jsonb_build_object('id', 'reactflow__edge-intent_router-fin', 'type', 'buttonEdge',
      'source', 'intent_router', 'target', 'transfer_to_fin', 'sourceHandle', 'rule_intent_fin',
      'animated', false, 'markerEnd', jsonb_build_object('type', 'arrowclosed'),
      'style', jsonb_build_object('strokeWidth', 2)),
    jsonb_build_object('id', 'reactflow__edge-intent_router-canc', 'type', 'buttonEdge',
      'source', 'intent_router', 'target', 'transfer_to_canc', 'sourceHandle', 'rule_intent_canc',
      'animated', false, 'markerEnd', jsonb_build_object('type', 'arrowclosed'),
      'style', jsonb_build_object('strokeWidth', 2)),
    jsonb_build_object('id', 'reactflow__edge-intent_router-else-1772133662928', 'type', 'buttonEdge',
      'source', 'intent_router', 'target', '1772133662928', 'sourceHandle', 'else',
      'animated', false, 'markerEnd', jsonb_build_object('type', 'arrowclosed'),
      'style', jsonb_build_object('strokeWidth', 2))
  );

  UPDATE public.chat_flows
  SET flow_definition = jsonb_build_object('nodes', v_updated_nodes, 'edges', v_updated_edges),
      updated_at = now()
  WHERE id = 'e44da799-c404-4c86-abe0-4aea2ca0ea1f';
END $$;
