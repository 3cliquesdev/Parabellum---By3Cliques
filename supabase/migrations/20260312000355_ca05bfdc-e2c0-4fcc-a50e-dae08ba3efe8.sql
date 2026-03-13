UPDATE chat_flows
SET flow_definition = jsonb_set(
  flow_definition,
  '{nodes}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN node->>'id' = 'ia_entrada' THEN
          jsonb_set(node, '{data,forbid_financial}', 'true'::jsonb)
        ELSE node
      END
    )
    FROM jsonb_array_elements(flow_definition->'nodes') AS node
  )
),
updated_at = now()
WHERE id = '912b366e-fc12-4a2d-9f5c-335e0bc611da'