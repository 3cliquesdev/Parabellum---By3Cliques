

# Adicionar seleção de vendedor específico na importação de deals

## Problema
Hoje o campo "Vendedor (nome)" só permite mapear para uma coluna do CSV. O usuário precisa também poder definir um vendedor específico do sistema para atribuir a **todos** os deals importados (quando não vem do CSV).

## Solução

### DealColumnMapper.tsx
- No campo `assigned_to`, adicionar um toggle (ou segundo select) com duas opções:
  - **"Da planilha"** — comportamento atual, mapeia coluna CSV
  - **"Vendedor fixo"** — exibe um dropdown com os vendedores do sistema (via `useSalesReps` ou `useAvailableSalesReps`)
- Nova prop `fixedAssignedTo?: string` e `onFixedAssignedToChange?: (userId: string | null) => void`
- Quando "Vendedor fixo" é selecionado, o mapping do `assigned_to` é removido e o `fixedAssignedTo` é setado com o `user_id` escolhido

### ImportDeals.tsx
- Novo state `fixedAssignedTo: string | null`
- Passar as novas props ao `DealColumnMapper`
- No `handleImport`, se `fixedAssignedTo` estiver definido, injetar `assigned_to_user_id` diretamente em cada deal mapeado (em vez do nome do vendedor)
- Passar `fixedAssignedTo` no body da edge function

### Edge Function `import-deals`
- Aceitar campo opcional `assigned_to_user_id` em cada deal
- Se presente, usar diretamente como `assigned_to` do deal (pular resolução por nome)
- Se não presente, manter lógica atual de resolver por nome

### UI do campo Vendedor
O campo terá dois modos lado a lado:
- Radio/tabs: "Coluna CSV" | "Vendedor fixo"
- Coluna CSV → select com headers do CSV (atual)
- Vendedor fixo → select com lista de vendedores do sistema (avatar + nome)

