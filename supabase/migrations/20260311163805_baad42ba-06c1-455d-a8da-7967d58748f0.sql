
-- ============================================================
-- FIX: Auto-assign deals with status 'won' + redistribute orphans + cleanup duplicates
-- ============================================================

-- 1. Update trigger to include 'won' status
CREATE OR REPLACE FUNCTION auto_assign_deal_on_insert()
RETURNS trigger AS $$
DECLARE
  v_rep_id uuid;
BEGIN
  -- Only auto-assign if no one is assigned AND status is open or won
  IF NEW.assigned_to IS NULL AND NEW.status IN ('open', 'won') THEN
    IF NEW.pipeline_id IS NOT NULL THEN
      SELECT get_least_loaded_sales_rep_for_pipeline(NEW.pipeline_id) INTO v_rep_id;
      IF v_rep_id IS NOT NULL THEN
        NEW.assigned_to := v_rep_id;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Clean duplicate pipeline_sales_reps entries
DELETE FROM pipeline_sales_reps
WHERE id NOT IN (
  SELECT DISTINCT ON (pipeline_id, user_id) id
  FROM pipeline_sales_reps
  ORDER BY pipeline_id, user_id, created_at ASC
);

-- 3. Redistribute orphan deals in Nacional pipeline via round-robin
DO $$
DECLARE
  nacional_pipeline_id uuid;
  rep_ids uuid[];
  rep_count int;
  deal_record record;
  idx int := 0;
BEGIN
  -- Find Nacional pipeline
  SELECT id INTO nacional_pipeline_id
  FROM pipelines
  WHERE name ILIKE '%nacional%'
  LIMIT 1;

  IF nacional_pipeline_id IS NULL THEN
    RAISE NOTICE 'Pipeline Nacional not found, skipping redistribution';
    RETURN;
  END IF;

  -- Get sales_reps for this pipeline
  SELECT array_agg(psr.user_id ORDER BY psr.created_at)
  INTO rep_ids
  FROM pipeline_sales_reps psr
  JOIN user_roles ur ON ur.user_id = psr.user_id
  WHERE psr.pipeline_id = nacional_pipeline_id
    AND ur.role = 'sales_rep';

  rep_count := coalesce(array_length(rep_ids, 1), 0);

  IF rep_count = 0 THEN
    RAISE NOTICE 'No sales_reps found for Nacional pipeline';
    RETURN;
  END IF;

  -- Round-robin assign orphan deals
  FOR deal_record IN
    SELECT id
    FROM deals
    WHERE pipeline_id = nacional_pipeline_id
      AND assigned_to IS NULL
      AND created_at >= '2025-02-27'
    ORDER BY created_at ASC
  LOOP
    UPDATE deals
    SET assigned_to = rep_ids[(idx % rep_count) + 1],
        updated_at = now()
    WHERE id = deal_record.id;
    
    idx := idx + 1;
  END LOOP;

  RAISE NOTICE 'Redistributed % orphan deals among % reps', idx, rep_count;
END $$;
