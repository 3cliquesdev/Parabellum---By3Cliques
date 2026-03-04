
-- Add safety and quality columns to knowledge_candidates
ALTER TABLE public.knowledge_candidates
  ADD COLUMN IF NOT EXISTS contains_pii boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS risk_level text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES public.knowledge_articles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clarity_score integer,
  ADD COLUMN IF NOT EXISTS completeness_score integer,
  ADD COLUMN IF NOT EXISTS evidence_snippets jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS sanitized_solution text;

-- Validation trigger for risk_level
CREATE OR REPLACE FUNCTION public.validate_risk_level()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.risk_level NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'risk_level must be low, medium, or high';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_risk_level ON public.knowledge_candidates;
CREATE TRIGGER trg_validate_risk_level
  BEFORE INSERT OR UPDATE ON public.knowledge_candidates
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_risk_level();
