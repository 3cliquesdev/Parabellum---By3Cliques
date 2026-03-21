

# Fix: Build errors + confirmação da seleção de opções

## Build Errors

### 1. `ai-autopilot-chat/index.ts` linha 11109 — `.catch()` em insert do Supabase
O método `.insert()` do Supabase retorna `PostgrestFilterBuilder`, não uma Promise com `.catch()`. 

**Fix**: Envolver em bloco try/catch ou usar `.then()`:
```typescript
// De:
await supabaseClient.from('ai_events').insert({...}).catch(() => {});
// Para:
const { error: _evtErr } = await supabaseClient.from('ai_events').insert({...});
```

### 2. `process-buffered-messages/index.ts` linha 619 — tipo `unknown`
`flowResult.options` vem de `json()` que retorna `any`, mas o TS infere `unknown`.

**Fix**: Cast explícito:
```typescript
// De:
formatOptionsAsText(flowResult.options)
// Para:
formatOptionsAsText(flowResult.options as any[])
```
Aplicar nos dois locais (linha 619 e linha 669).

## Sobre a seleção de opções pelo cliente

O matcher `matchAskOption` já suporta:
- Número ("1", "2", "3"...)
- Texto exato do label ("Atendente")
- Texto parcial unambíguo (palavra "atendente" dentro da frase)

O problema original era que as **opções não estavam sendo enviadas** no WhatsApp — o fix do `formatOptionsAsText` resolve isso. Com as opções visíveis, o cliente poderá responder com número ou texto normalmente.

## Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/ai-autopilot-chat/index.ts` | Remover `.catch()` inválido do insert |
| `supabase/functions/process-buffered-messages/index.ts` | Cast `as any[]` nos 2 usos de `flowResult.options` |

