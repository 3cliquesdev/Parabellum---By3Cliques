-- Remove duplicate refunded events (keep one per order_id)
DELETE FROM kiwify_events a
USING kiwify_events b
WHERE a.event_type = 'refunded'
  AND b.event_type = 'refunded'
  AND a.payload->>'order_id' = b.payload->>'order_id'
  AND a.id > b.id;