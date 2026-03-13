

## Problema

As edges salvas no banco (via SQL) não têm a propriedade `type: 'buttonEdge'`. Quando o editor carrega essas edges, elas aparecem como linhas retas padrão do ReactFlow (sem curva bezier e sem botão de remover). Já as edges criadas manualmente no editor recebem `type: 'buttonEdge'` no callback `onConnect`, por isso funcionam corretamente.

## Solução

Normalizar todas as edges ao carregar do `initialFlow`, garantindo que cada edge tenha `type: 'buttonEdge'`, `style` e `markerEnd` corretos.

## Alteração

**Arquivo:** `src/components/chat-flows/ChatFlowEditor.tsx` (linha ~199)

Trocar:
```ts
const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow?.edges || []);
```

Por algo como:
```ts
const normalizedEdges = useMemo(() => {
  return (initialFlow?.edges || []).map(edge => ({
    ...edge,
    type: edge.type || 'buttonEdge',
    style: edge.style || { strokeWidth: 2, stroke: 'hsl(var(--primary))' },
    markerEnd: edge.markerEnd || { type: MarkerType.ArrowClosed, color: 'hsl(var(--primary))' },
  }));
}, [initialFlow?.edges]);

const [edges, setEdges, onEdgesChange] = useEdgesState(normalizedEdges);
```

Isso faz com que todas as edges carregadas do banco herdem automaticamente o tipo curvo (bezier) com o botão X de remoção, igualando o comportamento das edges criadas manualmente.

