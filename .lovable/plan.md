

# Colorir Linhas (Edges) com a Cor da Opção de Origem

## Problema
As linhas que saem dos nós de múltipla escolha (AskOptionsNode) e condição (ConditionNode/ConditionV2Node) são todas da mesma cor padrão, tornando impossível saber visualmente qual linha pertence a qual opção.

## Solução
Quando uma conexão sai de um handle com cor específica (opções, condições, switch), a linha deve herdar essa cor. Isso envolve dois pontos:

### 1. `ChatFlowEditor.tsx` — `onConnect` e `normalizedEdges`

Ao criar uma nova conexão (`onConnect`), verificar o nó de origem: se for `ask_options`, `condition_v2`, ou outro nó com handles coloridos, pegar a cor do handle correspondente ao `sourceHandle` e aplicar no `style.stroke` e `markerEnd.color` da edge.

Criar uma função auxiliar `getEdgeColorFromSource(nodes, sourceId, sourceHandleId)` que:
- Encontra o nó de origem
- Se for `ask_options`: mapeia o índice da opção pelo `sourceHandle` (option.id) → retorna `optionColors[idx]`
- Se for `condition_v2`: mapeia pela regra → retorna `ruleColors[idx]`
- Senão: retorna `null` (usa cor padrão)

Aplicar essa mesma lógica no `normalizedEdges` (para edges já salvas no banco).

### 2. `ButtonEdge.tsx` — já funciona

O `ButtonEdge` já usa `style` recebido via props, então passar `stroke` com a cor correta já vai funcionar sem alteração neste componente.

### Arquivos alterados
- `src/components/chat-flows/ChatFlowEditor.tsx` — adicionar função `getEdgeColorFromSource`, atualizar `onConnect` e `normalizedEdges`

### Resultado visual
- Linha azul → opção "Pedidos" (azul)
- Linha verde → opção "Financeiro" (verde)
- Linha amarela → opção "Suporte" (amarelo)
- etc.

As cores seguirão exatamente o array `optionColors` já usado nos handles e labels dos nós.

