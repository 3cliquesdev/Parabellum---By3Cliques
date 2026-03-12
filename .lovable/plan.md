

# Fix: Handles do nó IA não clicáveis

## Diagnóstico

Os **labels de texto** (divs com `right-[-4px]`) estão sobrepostos aos handles, **bloqueando os cliques**. As divs capturam o evento de mouse antes do handle do ReactFlow.

## Correção

Adicionar `pointer-events-none` a todas as 5 divs de label (linhas 104-118) para que os cliques passem direto para os handles por baixo.

Também mover os labels mais para a direita (`right-[-50px]` ou similar) para não sobrepor visualmente os handles, garantindo que fiquem ao lado e não em cima.

**Arquivo**: `src/components/chat-flows/nodes/AIResponseNode.tsx` — linhas 104-118, adicionar `pointer-events-none` em cada div de label.

