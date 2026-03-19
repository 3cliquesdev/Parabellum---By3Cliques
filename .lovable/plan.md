

# Fix: Campos de texto não editáveis no editor de fluxos

## Problema

Quando você clica em um nó e tenta editar campos no painel de propriedades (nome do bloco, opções, regras de condição, etc.), o ReactFlow intercepta teclas como Backspace e Delete — em vez de apagar texto no campo, ele **deleta o nó selecionado**. Isso faz parecer que os campos são "não editáveis".

Apenas alguns Textareas tinham proteção individual (`onKeyDown stopPropagation`). Os campos Input (nome do bloco, labels de opções, labels de regras, valor de condição, save_as, etc.) não tinham.

## Correção

Adicionar `onKeyDown={(e) => e.stopPropagation()}` no container `ScrollArea` do painel de propriedades (linha ~650 do `ChatFlowEditor.tsx`). Isso protege **todos** os campos dentro do painel de uma vez só, sem precisar adicionar em cada Input individual.

### Arquivo afetado

- `src/components/chat-flows/ChatFlowEditor.tsx` — 1 edição na linha ~650:
  - Trocar `<ScrollArea className="flex-1 p-4">` por `<ScrollArea className="flex-1 p-4" onKeyDown={(e) => e.stopPropagation()}>`

Isso resolve o problema para todos os tipos de nó: ask_options, condition, condition_v2, ai_response, transfer, end, e qualquer outro.

