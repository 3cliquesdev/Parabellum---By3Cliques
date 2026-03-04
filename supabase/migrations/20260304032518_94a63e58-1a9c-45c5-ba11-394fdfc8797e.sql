
-- Useful indexes for curation filtering/sorting
CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_risk_created 
  ON public.knowledge_candidates (risk_level ASC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_pii_created 
  ON public.knowledge_candidates (contains_pii, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_candidates_duplicate 
  ON public.knowledge_candidates (duplicate_of) WHERE duplicate_of IS NOT NULL;
