

# Correção: Encoding UTF-8 quebrado no Widget (NÃ£o → Não)

## Causa Raiz
O `corsHeaders` (linha 8) já tem `'Content-Type': 'application/json; charset=utf-8'`, **porém ~290 responses individuais** no arquivo sobrescrevem com:
```
headers: { ...corsHeaders, 'Content-Type': 'application/json' }
```
O spread coloca o `charset=utf-8` primeiro, e depois a segunda propriedade `Content-Type` **sobrescreve** a anterior — removendo o `charset=utf-8`.

A response principal do widget está na linha 9516:
```typescript
headers: { ...corsHeaders, 'Content-Type': 'application/json' }  // ← sobrescreve charset!
```

## Correção

### `supabase/functions/ai-autopilot-chat/index.ts`
Remover **todos** os `'Content-Type': 'application/json'` individuais das ~290 responses, já que `corsHeaders` já inclui esse header com charset.

Trocar todas as ocorrências de:
```typescript
headers: { ...corsHeaders, 'Content-Type': 'application/json' }
```
Por:
```typescript
headers: corsHeaders
```

Como `corsHeaders` já tem `'Content-Type': 'application/json; charset=utf-8'` na linha 8, isso garante que **todas** as responses usam charset correto.

### Redeploy
A edge function precisa ser redeployada após a mudança.

## Impacto
- Todas as responses da edge function passam a incluir `charset=utf-8`
- Widget renderiza acentos corretamente (Não, não, ação, etc.)
- Zero impacto funcional — apenas header de encoding

