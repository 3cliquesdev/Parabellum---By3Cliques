
# Correção: Transferência de departamento não executada no Chat Flow

## Problema Identificado

A condição no fluxo "Olá! Concluí o onboarding do Armazém Drop" está configurada assim:
- `condition_type: "equals"`
- `condition_field: ""` (vazio)
- `condition_value: "Olá! Concluí o onboarding do Armazém Drop"`

A intenção é: se a mensagem do cliente for igual ao texto, ir para o Transfer Node (Customer Success). Porém, a função `evalCond` (e `evaluateCondition`) usam `fieldValue` baseado em `collectedData[condition_field]` -- como `condition_field` é vazio, `fieldValue` resulta em `""`, e a comparação `"" === "olá! concluí o onboarding..."` retorna `false`.

O fluxo segue o caminho "Não" (para o ask_options), nunca alcança o Transfer Node, e a IA Autopilot acaba respondendo com uma mensagem genérica de transferência -- sem executar a transferência real de departamento.

## Evidências

- Conversa `7c8c7e55`: `department: null`, `ai_mode: autopilot`
- Estado do fluxo: `status: active`, `current_node_id: 1769459303001` (transfer node registrado, mas nunca executado)
- Mensagem no chat ("Que legal saber que você tem interesse!") difere da mensagem do transfer node ("Ótimo, vou te transferir um consultor!") -- confirmando que foi a IA que respondeu, não o fluxo

## Solução

Corrigir as duas funções de avaliação de condição em `supabase/functions/process-chat-flow/index.ts` para usar `userMessage` como fallback quando `condition_field` estiver vazio.

### Mudança 1: Função `evalCond` (Master Flow traversal, ~linha 1014-1054)

Adicionar fallback: quando `condition_field` for vazio/nulo, usar `userMessage` como valor de comparação em vez de `fieldValue`.

```typescript
// Antes
let fieldValue = collectedData?.[condition_field] ?? (contactData ? contactData[condition_field] : null);

// Depois
let fieldValue = condition_field
  ? (collectedData?.[condition_field] ?? (contactData ? contactData[condition_field] : null))
  : userMessage; // Quando field vazio, comparar contra a mensagem do usuário
```

### Mudança 2: Função `evaluateCondition` (Active flow handler, ~linha 141-158)

Mesma correção:

```typescript
// Antes
const fieldValue = collectedData[condition_field] || "";

// Depois
const fieldValue = condition_field ? (collectedData[condition_field] || "") : userMessage;
```

## Impacto

| Item | Status |
|------|--------|
| Regressao | Zero -- condicoes com `condition_field` preenchido continuam igual |
| Fluxos com field vazio | Agora comparam contra a mensagem do usuario (comportamento esperado) |
| Transfer para Customer Success | Sera executado corretamente pelo webhook |
| Outros tipos de condicao | Beneficiados pelo mesmo fallback (contains, not_equals) |

## Notas Tecnicas

- O `meta-whatsapp-webhook` ja possui a logica de executar transferencias (linhas 740-763) -- essa parte esta correta
- O problema esta exclusivamente na avaliacao de condicao que impede o fluxo de chegar ao Transfer Node
- Apos a correcao, o fluxo retornara `transfer: true` e `departmentId: "b7149bf4-..."` (Customer Success), e o webhook executara o update de departamento normalmente
