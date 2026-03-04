

# Fix: Select não clicável dentro do Dialog "Adicionar Bloco"

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Problema

Os `Select` (Radix UI) dentro do `DialogContent` no `AddBlockDialog.tsx` não respondem a cliques. Isso é um problema conhecido do Radix UI: quando o dropdown do Select abre como portal, o Dialog interpreta o clique fora do `DialogContent` e fecha ou bloqueia a interação.

## Solução

**Arquivo: `src/components/dashboard-builder/AddBlockDialog.tsx`**

1. Adicionar `onPointerDownOutside={(e) => e.preventDefault()}` no `DialogContent` — impede que cliques no dropdown do Select sejam interpretados como "fora do dialog"
2. Adicionar `onInteractOutside={(e) => e.preventDefault()}` como segurança extra
3. Nos `SelectContent`, usar `position="popper"` e `sideOffset={4}` para melhorar o posicionamento do dropdown

Mudança de ~3 linhas, zero regressão nos demais componentes.

