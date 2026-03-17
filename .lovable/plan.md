

# Fix: Template retry going to Evolution instead of Meta

## Problem
Conversations created via Meta WhatsApp API have `whatsapp_provider` set to `'evolution'` instead of `'meta'`. When retrying a failed template message, the code checks `whatsapp_provider` and routes to the Evolution path, which fails because `whatsapp_instance_id` is null.

Evidence: All affected conversations have `whatsapp_meta_instance_id` set but `whatsapp_provider = 'evolution'` and `whatsapp_instance_id = null`.

## Solution (two-part fix)

### 1. Fix `retrySend` to be smarter about provider detection
In `src/hooks/useSendMessageInstant.tsx`, change the provider detection logic to infer the correct provider from available instance IDs rather than trusting `whatsapp_provider` blindly:

```
// Current (broken):
const provider = conv.whatsapp_provider || 'meta';

// Fixed:
const provider = conv.whatsapp_meta_instance_id ? 'meta' 
  : conv.whatsapp_instance_id ? 'evolution' 
  : (conv.whatsapp_provider || 'meta');
```

This ensures that if `whatsapp_meta_instance_id` is present, it always routes to Meta regardless of the `whatsapp_provider` field.

### 2. Fix existing bad data in database
Run a migration to correct all conversations that have `whatsapp_provider = 'evolution'` but only have a `whatsapp_meta_instance_id`:

```sql
UPDATE conversations 
SET whatsapp_provider = 'meta' 
WHERE whatsapp_provider = 'evolution' 
  AND whatsapp_meta_instance_id IS NOT NULL 
  AND whatsapp_instance_id IS NULL;
```

### 3. Fix the source of bad data
Search the webhook handlers that create/update conversations to ensure they set `whatsapp_provider` correctly when creating Meta API conversations.

