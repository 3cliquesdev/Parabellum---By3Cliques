-- Remover eventos duplicados (manter o mais recente por order_id)
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY payload->>'order_id', event_type 
           ORDER BY created_at DESC
         ) as rn
  FROM kiwify_events
  WHERE event_type = 'paid'
    AND payload->>'order_id' IS NOT NULL
)
DELETE FROM kiwify_events
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);