

# Bug: `edges is not defined` — process-chat-flow crashando na conversa #2D7EACE8

## Diagnóstico

Nos logs do `process-chat-flow`, o erro é claro:

```
ReferenceError: edges is not defined
  at ...index.ts:3595:29
```

**Causa raiz:** Linhas 3100 e 3102 do `process-chat-flow/index.ts` usam variáveis `edges` e `nodes` sem qualificação — deveriam ser `flowDef.edges` e `flowDef.nodes`:

```typescript
// L3100 — BUG: "edges" não existe neste escopo
const nodeEdges = edges.filter((e: any) => e.source === currentNode.id);
// L3102 — BUG: "nodes" não existe neste escopo  
const targetNode = nodes.find((n: any) => n.id === edge.target);
```

Esse bloco é a "inferência automática de forbidFinancial" — quando o nó AI tem edge para um condition_v2 com regra `ai_exit_intent=financeiro`. Como crasha antes de chegar na chamada da IA, o fluxo inteiro falha e o webhook faz fallback para `waiting_human`, abandonando a conversa.

## Impacto

Toda mensagem processada por um nó `ai_response` no motor de fluxos crasha se `forbid_financial` não estiver explicitamente `true` no nó. Ou seja, **qualquer nó AI sem forbid_financial explícito crashava o fluxo inteiro**.

## Plano de Correção

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `process-chat-flow/index.ts` L3100 | `edges` → `(flowDef.edges \|\| [])` |
| 2 | `process-chat-flow/index.ts` L3102 | `nodes` → `(flowDef.nodes \|\| [])` |

Fix de 2 linhas. Zero mudança de lógica, apenas corrige as referências para usar o objeto correto.

