

# Fix: Campos de opções não editáveis no editor de fluxos

## Problema

O `stopPropagation` no `ScrollArea` (linha 650) **não funciona** porque o ReactFlow usa um listener global no `document` (via `useKeyPress`), não um listener baseado em DOM bubbling. Quando você digita em qualquer Input do painel, o ReactFlow captura Backspace/Delete no nível do `document` antes que o `stopPropagation` tenha efeito — resultado: o nó é deletado em vez do texto ser editado.

## Correção

### Arquivo: `src/components/chat-flows/ChatFlowEditor.tsx`

1. **Desativar `deleteKeyCode` nativo do ReactFlow** — trocar `deleteKeyCode={['Backspace', 'Delete']}` por `deleteKeyCode={null}`

2. **Adicionar listener manual de deleção** que verifica se o foco está em input/textarea antes de deletar:
   - Escutar `keydown` no container do ReactFlow
   - Se a tecla for Backspace ou Delete **e** o `document.activeElement` **não** for input/textarea/contenteditable → deletar nós e edges selecionados
   - Caso contrário, deixar o evento seguir normalmente para o campo de texto

3. **Remover `onKeyDown stopPropagation` redundantes** do ScrollArea e Textareas individuais (não são mais necessários)

## Resultado

- Inputs de opções (label), condições, nomes de bloco → editáveis normalmente
- Backspace/Delete com nó selecionado no canvas (sem foco em input) → deleta o nó como antes
- Botões de adicionar/remover opções → continuam funcionando normalmente

