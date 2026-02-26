

# Plano: Fix do Auto-Avanço que Pula o Nó AI Response

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico com Evidência

O problema é um bug no **auto-avanço de nós `message`** (linhas 843-908 de `process-chat-flow/index.ts`).

### Caminho real do fluxo no manual trigger:

```text
start → welcome_ia (message) → condition (false) → ia_entrada (ai_response) → ask_options
```

### O que acontece:

1. Traversal inicial encontra `welcome_ia` (message) como primeiro nó de conteúdo
2. Estado salvo em `welcome_ia`, mensagem de boas-vindas entregue
3. **Auto-avanço** entra (linha 845: `if contentNode.type === 'message'`)
4. Iteração 1: `findNextNode(welcome_ia)` → condição → avalia false → `advanceNode = ia_entrada` — **SEM break** (estava dentro do handler de condição)
5. Iteração 2: `findNextNode(ia_entrada)` → `ask_options` → **break** (nó de conteúdo)
6. Estado atualizado para `ask_options` com `waiting_input`
7. Opções entregues ao cliente

**O nó `ia_entrada` (ai_response) é completamente pulado** porque o loop de auto-avanço não para em nós de conteúdo que foram alcançados via avaliação de condição.

### Código com bug (linhas 859-882):

```typescript
if (nextNode.type === 'condition') {
  // avalia condição...
  advanceNode = condNext;  // ← SEM break! Continua o loop.
} else if (nextNode.type === 'input' || nextNode.type === 'start') {
  advanceNode = nextNode;  // ← SEM break
} else {
  advanceNode = nextNode;
  break;  // ← Só para aqui (content nodes diretos)
}
```

O `ia_entrada` é definido como `advanceNode` pelo handler de condição, mas como não há `break`, a próxima iteração avança para `ask_options`.

## Solução

Adicionar verificação de tipo de conteúdo após setar `advanceNode` dentro do handler de condição. Se o nó alcançado via condição é um nó de conteúdo (`ai_response`, `ask_options`, `ask_input`, `transfer`, `message`), fazer `break`.

### Mudança: `process-chat-flow/index.ts` (linhas 873-875)

Após `advanceNode = condNext;`, adicionar:

```typescript
if (condNext) break;
advanceNode = condNext;
```

Não, mais simples — após `advanceNode = condNext;` verificar se é nó de conteúdo:

```typescript
advanceNode = condNext;
// Se alcançou um nó de conteúdo via condição, parar aqui
if (!['condition', 'input', 'start'].includes(advanceNode.type)) break;
```

Isso garante que quando a condição leva a um `ai_response`, o auto-avanço para ali em vez de continuar para o próximo nó.

## Resumo

| Arquivo | Mudança |
|---|---|
| `supabase/functions/process-chat-flow/index.ts` | Adicionar `break` após condição levar a nó de conteúdo no auto-avanço (1 linha) |

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — apenas corrige caso onde condição leva a ai_response; ask_options diretos continuam funcionando |
| Upgrade | Sim — ai_response agora é respeitado como ponto de parada no auto-avanço |
| Kill Switch | Não afetado |
| Fluxo nunca mudo | Não afetado — o nó ai_response será ativado corretamente e a IA vai responder |

