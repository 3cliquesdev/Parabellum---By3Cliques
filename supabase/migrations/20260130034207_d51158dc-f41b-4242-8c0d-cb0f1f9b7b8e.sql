-- Phase 3: Expand ai_suggestions for Observer System
-- Add columns for suggestion types, confidence scoring, and classification

ALTER TABLE public.ai_suggestions
  ADD COLUMN IF NOT EXISTS suggestion_type TEXT DEFAULT 'reply' 
    CHECK (suggestion_type IN ('reply', 'kb_gap', 'classification')),
  ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 0 
    CHECK (confidence_score >= 0 AND confidence_score <= 100),
  ADD COLUMN IF NOT EXISTS classification_label TEXT,
  ADD COLUMN IF NOT EXISTS kb_gap_description TEXT;

-- Index for fetching suggestions by type
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type 
  ON ai_suggestions(suggestion_type);

-- Index for KB Gaps pending review (for managers)
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_kb_gaps 
  ON ai_suggestions(suggestion_type, created_at DESC) 
  WHERE suggestion_type = 'kb_gap';

-- Index for classifications (for analytics)
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_classifications
  ON ai_suggestions(suggestion_type, created_at DESC)
  WHERE suggestion_type = 'classification';

COMMENT ON COLUMN ai_suggestions.suggestion_type IS 'Type of suggestion: reply (response), kb_gap (knowledge gap detected), classification (internal categorization)';
COMMENT ON COLUMN ai_suggestions.confidence_score IS 'AI confidence score 0-100 for this suggestion';
COMMENT ON COLUMN ai_suggestions.classification_label IS 'Internal classification label for analytics (e.g., Rastreio/Logística)';
COMMENT ON COLUMN ai_suggestions.kb_gap_description IS 'Description of detected knowledge gap';