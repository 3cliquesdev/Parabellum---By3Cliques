

# FIX 3 complementar — Linha 1804-1821

A linha 1804 é o auto-traverse do OTP "max attempts reached" (código incorreto). Tem 3 pontos que precisam de `condition_v2`:

## Alterações em `supabase/functions/process-chat-flow/index.ts`

### 1. Linha 1805 — while loop
```
['condition', 'input', 'start']  →  ['condition', 'condition_v2', 'input', 'start']
```

### 2. Linha 1806 — if interno
```
if (resolvedNode.type === 'condition')  →  if (resolvedNode.type === 'condition' || resolvedNode.type === 'condition_v2')
```

### 3. Linha 1809 — break check
```
!['condition', 'input', 'start']  →  !['condition', 'condition_v2', 'input', 'start']
```

### 4. Linha 1820 — nextStatus
```
resolvedNode.type === 'condition'  →  (resolvedNode.type === 'condition' || resolvedNode.type === 'condition_v2')
```

Nenhuma outra alteração necessária. Os demais 5 fixes estão confirmados corretos.

