

# Ajustes Finais ao Plano de Variáveis — PR-Ready

## Ajuste 1: Incluir `queue` em `buildVariablesContext()`

**Backend (`process-chat-flow/index.ts`):**
- Expandir select de conversations para incluir `queue`:
  - Linha 1885: `'id, contact_id'` → `'id, contact_id, channel, status, priority, protocol_number, queue, created_at, resolved_at'`
  - Linha 570: idem para manual trigger
- Na função `buildVariablesContext()`, incluir `queue` na lista de conversation fields:
  ```typescript
  for (const f of ['channel','status','priority','protocol_number','queue','created_at','resolved_at']) {
    if (conversationData[f] != null) ctx[`conversation_${f}`] = conversationData[f];
  }
  ```

---

## Ajuste 2: Padronizar `getVar()` — resolver único usado em TODOS os lugares

Criar uma função `getVar()` que centraliza a resolução:
```typescript
function getVar(
  field: string,
  collectedData: Record<string, any>,
  contactData: any,
  conversationData: any
): any {
  const f = field?.trim();
  if (!f) return null;
  // Aliases
  if (f === 'is_validated_customer' || f === 'isValidatedCustomer') {
    return contactData?.kiwify_validated ?? false;
  }
  return collectedData?.[f] ?? contactData?.[f] ?? conversationData?.[f] ?? null;
}
```

**Substituições:**
- `evaluateCondition()` (linha 160): trocar `collectedData[condition_field] || ""` por `getVar(condition_field, collectedData, contactData, conversationData)`
  - Requer adicionar `contactData` e `conversationData` como parâmetros
- `evaluateConditionPath()` (linha 204): propagar mesmos params
- `evalCond()` (linha 1902-1942): substituir todo o bloco de resolução manual por `getVar()`
- `manualEvalCond()` (linha 587-595): idem

Resultado: um único ponto de resolução — zero duplicação, zero chance de inconsistência.

---

## Ajuste 3: `getAvailableVariables()` percorre grafo backwards (não array linear)

No helper `variableCatalog.ts`, ao calcular `flowVars` para um `selectedNodeId`:
- Percorrer edges **backwards** a partir do nó selecionado (seguindo `edge.target → edge.source`) coletando os nós predecessores
- Só incluir `save_as` de nós que são **ancestrais** do nó atual no grafo
- Hoje o código (linha 608-613) faz `.filter((n: Node) => n.data?.save_as)` em **todos** os nós — isso mostra variáveis de branches paralelas que nunca serão alcançadas

```typescript
function getAncestorNodeIds(nodeId: string, edges: Edge[]): Set<string> {
  const ancestors = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.target === current && !ancestors.has(edge.source)) {
        ancestors.add(edge.source);
        queue.push(edge.source);
      }
    }
  }
  return ancestors;
}
```

Usado por autocomplete, warnings e condition selector.

---

## Ajuste 4: `condition_field.trim()` em todos os resolvers

Na função `getVar()` centralizada (ajuste 2), já incluído o `.trim()` no campo. Isso previne bugs silenciosos quando o usuário digita espaço antes/depois do nome do campo no editor.

Adicionalmente, no frontend ao salvar `condition_field`:
- Em `ChatFlowEditor.tsx` linha 687: `updateNodeData("condition_field", v.trim())`

---

## Resumo de mudanças

| Arquivo | Mudança |
|---|---|
| `supabase/functions/process-chat-flow/index.ts` | `getVar()` centralizado, `buildVariablesContext()` com `queue`, select expandido em 2 pontos |
| `src/components/chat-flows/variableCatalog.ts` | **Novo** — `getAvailableVariables()` com traversal backwards + `getAncestorNodeIds()` |
| `src/components/chat-flows/ChatFlowEditor.tsx` | Usar catálogo, `.trim()` no save, condition selector expandido |
| `src/components/chat-flows/VariableAutocomplete.tsx` | **Novo** — autocomplete `{{` |

