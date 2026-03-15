

# Bug: `process-chat-flow` crashando — variáveis de intent não declaradas

## Problema
A Edge Function `process-chat-flow` está crashando com `ReferenceError: saqueIntentMatch is not defined` na linha 3820 (compilada). A IA não responde porque o motor de fluxos morre antes de chegar à chamada de IA.

## Causa raiz
Na seção de declaração de variáveis de intent (linhas 2586-2592), faltam 5 variáveis que são referenciadas nas linhas 3378-3390:
- `saqueIntentMatch`
- `devolucaoIntentMatch`
- `pedidosIntentMatch`
- `sistemaIntentMatch`
- `internacionalIntentMatch`

Essas variáveis foram adicionadas no guard anti-saudação (FIX 2) e na condição de greeting exit, mas nunca foram declaradas com `let ... = false`.

## Correção
Adicionar as 5 declarações faltantes no bloco de declarações (após linha 2592):

```typescript
let saqueIntentMatch = false;
let devolucaoIntentMatch = false;
let pedidosIntentMatch = false;
let sistemaIntentMatch = false;
let internacionalIntentMatch = false;
```

## Ação adicional
Fazer o redeploy da `process-chat-flow` após a correção.

## Impacto
- Corrige 100% do crash atual — a IA voltará a responder
- Nenhuma alteração de lógica, apenas declaração das variáveis que já estavam em uso

