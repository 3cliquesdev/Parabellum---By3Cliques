

# Fix: Shift+Enter não funciona no textarea "Palavras de saída"

## Problema
O ReactFlow intercepta eventos de teclado (Enter, Backspace, Delete) quando o painel de propriedades está aberto. Isso impede que Shift+Enter insira novas linhas no textarea.

## Solução

### `src/components/chat-flows/panels/BehaviorControlsSection.tsx` (linha 173)
Adicionar `onKeyDown={(e) => e.stopPropagation()}` no Textarea de palavras de saída para impedir que o ReactFlow capture o evento de teclado.

```tsx
<Textarea
  onKeyDown={(e) => e.stopPropagation()}
  value={...}
  ...
/>
```

Mudança de 1 linha, zero regressão.

