

# Fix: Campos de opções não editáveis no Ask Options

## Problema

O `onChange` do input de opções chama `updateOption` **duas vezes** consecutivas — uma para `label` e outra para `value`. Cada chamada lê `selectedNode.data.options` do estado atual, mas a primeira chamada já atualiza o estado. A segunda chamada usa o estado **stale** (antigo), sobrescrevendo a mudança do label. Resultado: o texto digitado é imediatamente apagado.

## Correção

### Arquivo: `src/components/chat-flows/ChatFlowEditor.tsx`

**1. Alterar `updateOption` (linha ~493)** para aceitar múltiplos campos de uma vez:

```typescript
const updateOption = (idx: number, updates: Record<string, string>) => {
  if (!selectedNode) return;
  const options = [...(selectedNode.data.options || [])];
  options[idx] = { ...options[idx], ...updates };
  updateNodeData('options', options);
};
```

**2. Alterar o `onChange` do input de opções (linha ~771)** para passar label e value numa única chamada:

```typescript
onChange={(e) => {
  updateOption(idx, { label: e.target.value, value: slugify(e.target.value) });
}}
```

**3. Atualizar `removeOption` (linha ~478)** — não precisa mudar, já usa chamada única.

Isso resolve a condição de corrida sem mudar mais nada.

