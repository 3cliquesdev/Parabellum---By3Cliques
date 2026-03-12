

# Fix: Nó de Condição ignorando dados do contato no modo clássico

## Problema

O nó "Tem Consultor?" sempre retorna `false`, mesmo quando o contato tem `consultant_id` no banco de dados. O contato aparece com consultor atribuído, mas o fluxo não roteia corretamente.

## Causa Raiz

**Linha 520** em `evaluateConditionPath` — o fallback do modo clássico (regra única, sem `condition_rules`) passa `undefined, undefined` para `contactData` e `conversationData` ao invés de encaminhar os parâmetros que já recebeu:

```text
// BUG (linha 520):
evaluateCondition(nodeData, collectedData, userMessage, extraFlags, undefined, undefined)

// CORRETO:
evaluateCondition(nodeData, collectedData, userMessage, extraFlags, contactData, conversationData)
```

Isso faz com que `getVar` nunca encontre `consultant_id` — porque está no `contactData` que chega como `undefined`.

**Bug secundário — Linha 1517**: Uma chamada na zona Manual também omite os dados do contato.

## Correção

**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

| Linha | O que muda |
|-------|-----------|
| 520 | Encaminhar `contactData` e `conversationData` para `evaluateCondition` |
| 1517 | Adicionar `manualContactData` e `manualConversation` na chamada da zona Manual |

2 linhas alteradas. Zero mudança de lógica — apenas encaminhando parâmetros que já estavam disponíveis mas não eram passados.

