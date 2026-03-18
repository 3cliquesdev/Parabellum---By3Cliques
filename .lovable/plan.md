

# Plano: Adicionar campo "Responsável" na configuração de Ticket do nó IA

## O que falta
O `ticketConfig` permite definir departamento, categoria e prioridade, mas não tem campo `assigned_to` para vincular o ticket a um usuário responsável.

## Alterações

### 1. `AIResponsePropertiesPanel.tsx`
- Importar `useSupportAgents` (já lista todos os agentes/gestores disponíveis)
- Adicionar um `Select` de **"Responsável"** entre Departamento e Categoria (linhas ~246-248), com:
  - Opção "Nenhum (auto)" como default
  - Lista de agentes com avatar + nome
- Salvar em `ticketConfig.assigned_to` (UUID do usuário)

### 2. `ai-autopilot-chat/index.ts`
- Na seção `create_ticket` tool call, consumir `ticketConfig.assigned_to` como default para o campo `assigned_to` do ticket quando a IA não especificar um

### 3. `process-chat-flow/index.ts`
- Garantir que `assigned_to` do `ticketConfig` é propagado nos pontos de criação de ticket automática (nós `create_ticket` e ação ao sair)

