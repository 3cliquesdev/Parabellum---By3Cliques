

## Plano: Corrigir Edges (curvas + labels + remoção)

### Problema 1: Edges retas
As edges no banco estão salvas com `type: 'smoothstep'` — isso faz o ReactFlow renderizar linhas retas/escalonadas em vez do `ButtonEdge` (bezier com botão X). A normalização atual usa `edge.type || 'buttonEdge'`, que **não** substitui porque `'smoothstep'` é truthy.

**Fix:** Trocar para `type: 'buttonEdge'` incondicional (forçar sempre):
```ts
const normalizedEdges = useMemo(() => {
  return (initialFlow?.edges || []).map(edge => ({
    ...edge,
    type: 'buttonEdge',  // ← forçar sempre, ignorando valor do banco
    style: edge.style || { strokeWidth: 2, stroke: 'hsl(var(--primary))' },
    markerEnd: edge.markerEnd || { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
  }));
}, [initialFlow?.edges]);
```

### Problema 2: Labels nas edges não aparecem
As edges no banco têm labels como "Sim", "Não", "Saque", "Financeiro" etc. Porém o componente `ButtonEdge` ignora a prop `label` — só renderiza o botão de deletar.

**Fix:** Atualizar `ButtonEdge` para renderizar a label da edge (quando existir) junto com o botão de deletar. Adicionar `label` e `data` às props destructured e renderizar um badge/texto ao lado do botão X.

### Sobre a Condição V2 com uma saída
O nó "Cliente já conhecido?" mostra "Nenhuma regra configurada" porque `condition_rules` está vazio no banco. Quando regras forem adicionadas pelo painel lateral, cada regra gera automaticamente 2 handles (Sim/Não) + 1 handle "Outros". Com zero regras, só tem o handle padrão do wrapper — isso é o comportamento esperado. Não há problema com uma saída quando não há regras configuradas.

### Arquivos alterados
1. **`src/components/chat-flows/ChatFlowEditor.tsx`** — Forçar `type: 'buttonEdge'` na normalização (linha ~202)
2. **`src/components/playbook/ButtonEdge.tsx`** — Adicionar renderização da `label` da edge

