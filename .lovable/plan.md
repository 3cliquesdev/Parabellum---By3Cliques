

# Fix: Word-boundary Matching — User Input as Substring of Label

## Problem

The `matchAskOption` function (L161-198) has 4 matching layers, but none handles the case where the user types a **keyword from within the label**:

- User types: `"Nacional"`
- Option label: `"Drop Nacional"`

Layer 4 tests: does `\bdrop nacional\b` exist in `"nacional"`? → **No** (wrong direction).

The correct check should also test: does `\bnacional\b` exist in `"drop nacional"`? → **Yes**.

## Fix

**File:** `supabase/functions/process-chat-flow/index.ts` (L188-198)

Add a **5th matching layer** after Layer 4:

```typescript
// 5️⃣ Input contido no label como palavra (reverso do Layer 4)
// Ex: "Nacional" → match "Drop Nacional"
if (normalized.length >= 3) {
  const reverseMatches = options.filter(opt => {
    const label = opt.label.toLowerCase();
    const regex = new RegExp(`\\b${normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(label);
  });
  if (reverseMatches.length === 1) return reverseMatches[0];
}
```

Key safeguards:
- Minimum 3 characters to avoid false positives (e.g., "do" matching "Drop Nacional")
- Only matches if exactly 1 option matches (unambiguous)

## Redeploy

Deploy `process-chat-flow` after the edit.

