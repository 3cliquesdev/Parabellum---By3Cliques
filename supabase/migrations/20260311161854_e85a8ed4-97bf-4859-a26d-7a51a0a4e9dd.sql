
-- Master Flow Audit Fix: 3 corrections
-- 1. Reconnect: start → welcome_ia (remove start → Condição)
-- 2. Add: ia_entrada --ai_exit--> Condição
-- 3. Add: Inatividade 6min --false--> Condição  
-- 4. Add: Inatividade 1min --false--> Transfer Comercial

DO $$
DECLARE
  flow_id uuid := 'e44da799-c404-4c86-abe0-4aea2ca0ea1f';
  current_def jsonb;
  current_edges jsonb;
  new_edges jsonb;
BEGIN
  SELECT flow_definition INTO current_def FROM chat_flows WHERE id = flow_id;
  
  IF current_def IS NULL THEN
    RAISE EXCEPTION 'Master Flow not found';
  END IF;
  
  current_edges := current_def->'edges';
  
  -- Remove the old start → Condição edge
  new_edges := '[]'::jsonb;
  FOR i IN 0..jsonb_array_length(current_edges) - 1 LOOP
    IF current_edges->i->>'id' != 'reactflow__edge-start-1769459229369' THEN
      new_edges := new_edges || jsonb_build_array(current_edges->i);
    END IF;
  END LOOP;
  
  -- Add edge: start → welcome_ia
  new_edges := new_edges || jsonb_build_array(jsonb_build_object(
    'id', 'reactflow__edge-start-welcome_ia',
    'type', 'buttonEdge',
    'style', jsonb_build_object('strokeWidth', 2),
    'source', 'start',
    'target', 'welcome_ia',
    'animated', false,
    'markerEnd', jsonb_build_object('type', 'arrowclosed'),
    'sourceHandle', null,
    'targetHandle', null
  ));
  
  -- Add edge: ia_entrada --ai_exit--> Condição
  new_edges := new_edges || jsonb_build_array(jsonb_build_object(
    'id', 'reactflow__edge-ia_entrada_ai_exit-1769459229369',
    'type', 'buttonEdge',
    'style', jsonb_build_object('strokeWidth', 2),
    'source', 'ia_entrada',
    'target', '1769459229369',
    'animated', false,
    'markerEnd', jsonb_build_object('type', 'arrowclosed'),
    'sourceHandle', 'ai_exit',
    'targetHandle', null
  ));
  
  -- Add edge: Inatividade 6min --false--> Condição
  new_edges := new_edges || jsonb_build_array(jsonb_build_object(
    'id', 'reactflow__edge-1772133662928false-1769459229369',
    'type', 'buttonEdge',
    'style', jsonb_build_object('strokeWidth', 2),
    'source', '1772133662928',
    'target', '1769459229369',
    'animated', false,
    'markerEnd', jsonb_build_object('type', 'arrowclosed'),
    'sourceHandle', 'false',
    'targetHandle', null
  ));
  
  -- Add edge: Inatividade 1min --false--> Transfer Comercial
  new_edges := new_edges || jsonb_build_array(jsonb_build_object(
    'id', 'reactflow__edge-1772196913050false-1769460592402',
    'type', 'buttonEdge',
    'style', jsonb_build_object('strokeWidth', 2),
    'source', '1772196913050',
    'target', '1769460592402',
    'animated', false,
    'markerEnd', jsonb_build_object('type', 'arrowclosed'),
    'sourceHandle', 'false',
    'targetHandle', null
  ));
  
  -- Update the flow
  UPDATE chat_flows 
  SET flow_definition = jsonb_set(current_def, '{edges}', new_edges),
      updated_at = now()
  WHERE id = flow_id;
  
  RAISE NOTICE 'Master Flow updated. Old edges: %, New edges: %', 
    jsonb_array_length(current_edges), jsonb_array_length(new_edges);
END $$;
