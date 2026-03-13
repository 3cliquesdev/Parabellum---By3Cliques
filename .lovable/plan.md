

# Fix deptSearchName — Mapeamento mais preciso para novos intents

## Problema identificado

A Alteração 9 foi implementada corretamente, mas o `deptSearchName` (linha 3617) tem mapeamentos que podem causar conflitos:

| Intent | Atual | Risco |
|---|---|---|
| `saqueIntentMatch` | `%financ%` | Mistura saque com financeiro genérico |
| `sistemaIntentMatch` | `%suporte%` | Conflita com suporte humano genérico |
| `pedidosIntentMatch` | `%pedido%` | OK se dept existe com "pedido" no nome |

## Mudança

Linha 3617, substituir:

```typescript
// ANTES:
const deptSearchName = saqueIntentMatch ? '%financ%' : financialIntentMatch ? '%financ%' : devolucaoIntentMatch ? '%devolu%' : pedidosIntentMatch ? '%pedido%' : cancellationIntentMatch ? '%cancel%' : internacionalIntentMatch ? '%internac%' : commercialIntentMatch ? '%comerci%' : sistemaIntentMatch ? '%suporte%' : consultorIntentMatch ? '%consult%' : '%suporte%';

// DEPOIS:
const deptSearchName = saqueIntentMatch ? '%saque%' : financialIntentMatch ? '%financ%' : devolucaoIntentMatch ? '%devolu%' : pedidosIntentMatch ? '%pedido%' : cancellationIntentMatch ? '%cancel%' : internacionalIntentMatch ? '%internac%' : commercialIntentMatch ? '%comerci%' : sistemaIntentMatch ? '%sistema%' : consultorIntentMatch ? '%consult%' : '%suporte%';
```

Diferenças:
- `saqueIntentMatch`: `%financ%` → `%saque%` — busca dept com "saque" no nome
- `sistemaIntentMatch`: `%suporte%` → `%sistema%` — evita conflito com suporte genérico

Se os departamentos no banco tiverem nomes diferentes (ex: "Financeiro - Saques"), ajustar os patterns LIKE de acordo.

## Arquivo
- `supabase/functions/process-chat-flow/index.ts` — 1 edição na linha 3617

