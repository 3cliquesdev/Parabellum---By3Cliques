

# Corrigir TODOS os pontos de "template hardcore" — Respeitar Objective do Fluxo

## Problema

A correção anterior (L6913-6934 no `identityWallNote`) foi aplicada corretamente, mas existem **5 outros pontos** no `ai-autopilot-chat/index.ts` que continuam despejando o template completo de coleta PIX de forma literal, ignorando o `objective` do nó. O fluxo é soberano — se o nó tem `objective` dizendo "pergunte um campo por vez", TODOS os caminhos devem respeitar isso.

## Pontos a corrigir

| # | Linha | Contexto | O que faz hoje | Correção |
|---|-------|----------|----------------|----------|
| 1 | **L6519-6520** | `directOTPSuccessResponse` — resposta direta quando OTP valida inline | Envia `buildCollectionMessage()` verbatim | Se `nodeObjective` existe, enviar apenas "Identidade confirmada! ✅" e deixar a LLM seguir o objective |
| 2 | **L7067-7089** | `otpVerifiedInstruction` — instrução no system prompt | Diz "ENVIE EXATAMENTE esta mensagem" e "NÃO pergunte um campo por vez" | Se `nodeObjective` existe, substituir por instrução que manda seguir o objective com campos como referência |
| 3 | **L8006-8009** | Fallback quando LLM retorna vazio + OTP verificado | Despeja `structuredCollectionMessage` direto | Se `nodeObjective` existe, usar mensagem genérica + delegar à LLM |
| 4 | **L8652-8666** | Handler de verificação OTP inline | Envia "preciso dos seguintes dados:" + template completo | Se `nodeObjective` existe, enviar apenas confirmação e deixar LLM coletar campo a campo |
| 5 | **L9831-9834** | Fallback blocker (FIX#57AA2190) | Envia `buildCollectionMessage` diretamente ao WhatsApp | Se `nodeObjective` existe, enviar confirmação genérica e deixar LLM seguir |

## Lógica unificada

Em todos os 5 pontos, aplicar o mesmo padrão:

```typescript
const nodeObjective = flow_context?.objective;

if (nodeObjective) {
  // Fluxo soberano: não enviar template literal
  // Enviar apenas confirmação curta, a LLM segue o objective
  response = `✅ Identidade verificada com sucesso, ${contactName}! Vou dar continuidade ao seu atendimento.`;
} else {
  // Sem objective: manter comportamento atual (template literal)
  response = buildCollectionMessage(...);
}
```

Para o ponto 2 (`otpVerifiedInstruction` no system prompt), a lógica muda de:
```
"ENVIE EXATAMENTE esta mensagem... NÃO pergunte um campo por vez"
```
Para (quando `nodeObjective` existe):
```
"SIGA O OBJECTIVE DO NÓ: ${nodeObjective}. 
Campos a coletar (referência interna, NÃO envie tudo de uma vez): ${structuredCollectionMessage}"
```

## Arquivo afetado

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/ai-autopilot-chat/index.ts` | 5 blocos condicionais adicionados |

## Deploy
- `ai-autopilot-chat`

