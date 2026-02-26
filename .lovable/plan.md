

# Fix: Clicar em "Excluir" abre o fluxo ao invés de excluir

## Problema
Na linha 136 de `ChatFlows.tsx`, o `<Card>` inteiro tem `onClick={() => handleEditFlow(flow)}`. Os itens do `DropdownMenu` (Editar, Duplicar, Ativar, Excluir, etc.) não chamam `e.stopPropagation()`, então o clique propaga para o Card e navega para o editor.

O `DropdownMenuTrigger` já tem `e.stopPropagation()` (linha 160), mas os `DropdownMenuItem` não têm. Dependendo da versão do Radix e do portal, o evento pode borbulhar.

## Alteração (1 arquivo)

### `src/pages/ChatFlows.tsx`
Adicionar `e.stopPropagation()` em todos os `DropdownMenuItem` onClick handlers dentro do card:

- **Linha 166** (Editar): `onClick={(e) => { e.stopPropagation(); handleEditFlow(flow); }}`
- **Linha 170** (Duplicar): `onClick={(e) => { e.stopPropagation(); duplicateFlow.mutate(flow); }}`
- **Linha 175** (Ativar/Desativar): `onClick={(e) => { e.stopPropagation(); toggleActive.mutate(...); }}`
- **Linha 191** (Mestre): `onClick={(e) => { e.stopPropagation(); setMasterFlow.mutate(...); }}`
- **Linha 200** (Excluir): `onClick={(e) => { e.stopPropagation(); setSelectedFlow(flow); setShowDeleteDialog(true); }}`

