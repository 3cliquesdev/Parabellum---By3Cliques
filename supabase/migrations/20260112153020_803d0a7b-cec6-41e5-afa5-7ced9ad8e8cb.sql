-- ============================================
-- DEDUPE: Merge duplicate contacts by phone
-- ============================================

-- Step 1: Create a temp table to identify the "canonical" contact per phone
-- Priority: has email > oldest created_at
CREATE TEMP TABLE canonical_contacts AS
SELECT DISTINCT ON (phone) 
  id as canonical_id,
  phone
FROM contacts
WHERE phone IS NOT NULL AND phone != ''
ORDER BY phone, 
  CASE WHEN email IS NOT NULL AND email != '' THEN 0 ELSE 1 END,
  created_at ASC;

-- Step 2: First, close all duplicate open conversations before merging
-- For each contact that will be merged, close their conversations except the most recent one
WITH ranked_conversations AS (
  SELECT 
    c.id,
    c.contact_id,
    cc.canonical_id,
    ROW_NUMBER() OVER (PARTITION BY cc.canonical_id ORDER BY c.last_message_at DESC) as rn
  FROM conversations c
  JOIN contacts cont ON c.contact_id = cont.id
  JOIN canonical_contacts cc ON cont.phone = cc.phone
  WHERE c.status = 'open'
)
UPDATE conversations
SET status = 'closed', closed_at = NOW()
WHERE id IN (
  SELECT id FROM ranked_conversations WHERE rn > 1
);

-- Step 3: Now update all conversations to point to canonical contact
-- Since we closed duplicates, this should not violate the unique constraint
UPDATE conversations c
SET contact_id = cc.canonical_id
FROM contacts orig
JOIN canonical_contacts cc ON orig.phone = cc.phone
WHERE c.contact_id = orig.id
  AND orig.id != cc.canonical_id;

-- Step 4: Delete duplicate contacts (keep only canonical)
DELETE FROM contacts c
USING canonical_contacts cc
WHERE c.phone = cc.phone
  AND c.id != cc.canonical_id;

-- Step 5: Drop temp table
DROP TABLE canonical_contacts;

-- ============================================
-- ADD UNIQUE CONSTRAINT on phone (non-null)
-- ============================================
-- This prevents future duplicates

-- First drop any existing index if exists
DROP INDEX IF EXISTS idx_contacts_phone_unique;

-- Create unique index (allows multiple NULLs)
CREATE UNIQUE INDEX idx_contacts_phone_unique 
ON contacts (phone) 
WHERE phone IS NOT NULL AND phone != '';

-- Also add unique index on whatsapp_id for WhatsApp deduplication
DROP INDEX IF EXISTS idx_contacts_whatsapp_id_unique;

CREATE UNIQUE INDEX idx_contacts_whatsapp_id_unique 
ON contacts (whatsapp_id) 
WHERE whatsapp_id IS NOT NULL AND whatsapp_id != '';