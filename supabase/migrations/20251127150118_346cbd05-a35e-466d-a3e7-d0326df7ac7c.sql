-- Add video and content fields to customer_journey_steps
ALTER TABLE customer_journey_steps 
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS rich_content TEXT,
  ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS video_completed_at TIMESTAMPTZ;

COMMENT ON COLUMN customer_journey_steps.video_url IS 'YouTube, Vimeo, Loom, or direct video URL';
COMMENT ON COLUMN customer_journey_steps.rich_content IS 'HTML content for the step';
COMMENT ON COLUMN customer_journey_steps.attachments IS 'Array of file attachments with name, url, type';
COMMENT ON COLUMN customer_journey_steps.video_completed IS 'Whether customer watched video to completion';
COMMENT ON COLUMN customer_journey_steps.video_completed_at IS 'Timestamp when video was completed';