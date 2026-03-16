
# Ticket no Nó IA + Departamento + Continuidade do Fluxo — ✅ IMPLEMENTADO

## O que mudou

### 1. Nó `create_ticket` — Campo de Departamento ✅
- **`ChatFlowEditor.tsx`**: Adicionado `<Select>` de departamento (departments ativos) ao painel de propriedades
- Defaults atualizados com `department_id: null, department_name: null`
- **`CreateTicketNode.tsx`**: Badge visual do departamento no nó

### 2. Nó `ai_response` — Ação ao Sair: Criar Ticket ✅
- **`AIResponsePropertiesPanel.tsx`**: Nova seção "Ação ao Sair" com opção `create_ticket`
  - Campos: assunto, descrição, categoria, prioridade, departamento, usar dados coletados
  - Dados salvos em `end_action` e `action_data` no node data
- **`AIResponseNode.tsx`**: Badge "🎫 Ticket" quando `end_action === 'create_ticket'`

### 3. Motor `process-chat-flow` — Zero alteração necessária ✅
- O motor já suporta `end_action: create_ticket` em 8+ pontos (L2034, L2262, L2444, L2887, L4153, L4541, L5342, L5711)
- Lê `action_data.subject`, `action_data.description`, `action_data.category`, `action_data.priority`, `action_data.department_id`

### 4. Continuidade do Fluxo ✅
- O nó `create_ticket` já faz auto-advance para o próximo nó conectado
- A solução é **visual**: conectar `create_ticket` → `ask_options` (escape) em vez de → `transfer`
