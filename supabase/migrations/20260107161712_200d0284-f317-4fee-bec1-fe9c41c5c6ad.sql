-- Add score_routing_rules column to forms table for dynamic routing based on lead score
ALTER TABLE forms ADD COLUMN IF NOT EXISTS score_routing_rules JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN forms.score_routing_rules IS 'JSON structure: { enabled: boolean, rules: [{ classification: string, min_score: number, max_score: number|null, pipeline_id: uuid|null, playbook_id: uuid|null, playbook_start_node_id: string|null }] }';