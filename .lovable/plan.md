

# Adicionar opção de Atribuir Consultor quando "Sem consultor atribuído"

## Contexto
Na busca por email da página Consultores, quando o contato não tem consultor, aparece apenas o badge "Sem consultor atribuído". O usuário quer um botão para atribuir um consultor diretamente.

## Mudanças

### `src/pages/Consultants.tsx`
1. Substituir o badge estático "Sem consultor atribuído" por um **dropdown/select** com a lista de consultores ativos (usando `useActiveConsultants()`)
2. Ao selecionar um consultor, executar mutation que faz `UPDATE contacts SET consultant_id = selectedConsultantId WHERE id = contactId`
3. Registrar interação no histórico (tipo `note`)
4. Atualizar o resultado local da busca para refletir a mudança
5. Visível apenas para roles com `hasFullAccess`

### Implementação
- Importar `useActiveConsultants` do hook existente
- Adicionar `Select` (Radix) inline no card de resultado onde hoje está o badge
- Nova mutation `assignMutation` similar à `unlinkMutation` mas setando `consultant_id` ao invés de null
- Para usuários sem permissão, manter o badge atual read-only

