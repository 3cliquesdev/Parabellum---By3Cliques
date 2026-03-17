
# Ticket no Nó IA + Departamento + Responsável + Continuidade do Fluxo — ✅ IMPLEMENTADO

## O que mudou

### 1. Nó `create_ticket` — Campo de Departamento + Responsável ✅
- **`ChatFlowEditor.tsx`**: Adicionado `<Select>` de departamento (departments ativos) + `<Select>` de responsável (agentes do departamento via `useUsersByDepartment`)
- Defaults atualizados com `department_id: null, department_name: null, assigned_to: null, assigned_to_name: null`
- Ao trocar departamento, responsável é limpo automaticamente
- **`CreateTicketNode.tsx`**: Badges visuais do departamento e do responsável

### 2. Nó `ai_response` — Ação ao Sair: Criar Ticket ✅
- **`AIResponsePropertiesPanel.tsx`**: Nova seção "Ação ao Sair" com opção `create_ticket`
  - Campos: assunto, descrição, categoria, prioridade, departamento, responsável, usar dados coletados
  - Departamento + responsável com mesma lógica reativa (agentes filtrados por departamento)
  - Dados salvos em `end_action` e `action_data` no node data
- **`AIResponseNode.tsx`**: Badge "🎫 Ticket" quando `end_action === 'create_ticket'`

### 3. Motor `process-chat-flow` — Zero alteração necessária ✅
- O motor já suporta `end_action: create_ticket` e `assigned_to` nos dados do nó
- Lê `action_data.subject`, `action_data.description`, `action_data.category`, `action_data.priority`, `action_data.department_id`, `action_data.assigned_to`

### 4. Continuidade do Fluxo ✅
- O nó `create_ticket` já faz auto-advance para o próximo nó conectado
- A solução é **visual**: conectar `create_ticket` → `ask_options` (escape) em vez de → `transfer`
