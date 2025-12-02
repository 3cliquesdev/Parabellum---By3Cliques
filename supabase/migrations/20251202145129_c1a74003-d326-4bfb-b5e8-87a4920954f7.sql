-- Add auto_move_config column to stages table for pipeline automation
ALTER TABLE stages ADD COLUMN IF NOT EXISTS auto_move_config JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN stages.auto_move_config IS 'Config for automatic deal movement when won. Structure: {"on_status": "won", "target_pipeline_id": "uuid", "target_stage_id": "uuid"}';