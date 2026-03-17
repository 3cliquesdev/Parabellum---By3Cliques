

# Adicionar Responsável (Agente) ao Nó Criar Ticket

## Problema
O nó `create_ticket` permite selecionar departamento, mas não permite selecionar **quem** daquele departamento será o responsável pelo ticket. Sem isso, o ticket fica sem `assigned_to`.

## Solução
Adicionar um select de **Responsável** que aparece quando um departamento é selecionado, listando os agentes daquele departamento usando o hook `useUsersByDepartment` já existente.

## Alterações

### 1. `ChatFlowEditor.tsx`
- Importar `useUsersByDepartment`
- Adicionar estado reativo: quando `department_id` muda, o select de agentes atualiza automaticamente
- Após o select de Departamento, adicionar select de **Responsável** com opções:
  - "Sem responsável (pool do departamento)" — default
  - Lista de agentes do departamento selecionado
- Salvar `assigned_to` e `assigned_to_name` no node data
- Atualizar defaults: `assigned_to: null, assigned_to_name: null`
- Aplicar a mesma lógica nos **dois locais**: painel do nó `create_ticket` (L1426-1448) e seção `end_action: create_ticket` do `ai_response` (L1258-1337)

### 2. `CreateTicketNode.tsx`
- Exibir badge com nome do responsável quando `assigned_to_name` estiver preenchido

### 3. Motor (`process-chat-flow`)
- Já lê `assigned_to` do node data — zero alteração necessária no backend

