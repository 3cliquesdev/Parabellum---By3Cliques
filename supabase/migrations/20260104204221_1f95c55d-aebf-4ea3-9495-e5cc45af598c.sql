-- Update contacts with NULL source that have associated deals to 'legado'
UPDATE contacts 
SET source = 'legado' 
WHERE source IS NULL 
AND id IN (SELECT DISTINCT contact_id FROM deals WHERE contact_id IS NOT NULL);