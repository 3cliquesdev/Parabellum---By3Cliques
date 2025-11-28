-- FASE 1: Add probability column to stages table for financial forecasting
ALTER TABLE stages ADD COLUMN IF NOT EXISTS probability INTEGER DEFAULT 50;

COMMENT ON COLUMN stages.probability IS 'Probabilidade de conversão da etapa (0-100%) para cálculo de forecast ponderado';

-- Update existing stages with realistic probabilities based on position
UPDATE stages 
SET probability = CASE 
  WHEN position = 0 THEN 10  -- First stage: 10% probability
  WHEN position = 1 THEN 25  -- Second stage: 25%
  WHEN position = 2 THEN 50  -- Third stage: 50%
  WHEN position = 3 THEN 75  -- Fourth stage: 75%
  ELSE 90  -- Final stages before closing: 90%
END
WHERE probability = 50; -- Only update default values