
# Configurar quila@3cliques.net como Atendente no Departamento Operacional

## Usuário encontrado
- **Nome:** quila@3cliques.net
- **ID:** `c88004fa-e717-46d7-bbcd-8cfe1e87b3e7`
- **Role atual:** `user` (cliente)
- **Departamento:** nenhum

## Departamento encontrado
- **Operacional:** `fcba332e-d8d6-4db3-acc1-8b5fab6941be`

## Ações necessárias

### 1. Alterar role de `user` → `support_agent`
Atualizar a tabela `user_roles` para mudar o papel de cliente para agente de suporte.

### 2. Atualizar departamento no perfil
Setar `department = 'Operacional'` na tabela `profiles`.

### 3. Vincular ao departamento via `agent_departments`
Inserir registro em `agent_departments` com `department_id` do Operacional como departamento primário, usando a RPC `set_agent_departments`.

### 4. Atualizar nome de exibição
O `full_name` atual é o próprio email — pode ser mantido ou atualizado se houver um nome real.

## Resultado
O usuário passará a aparecer como agente de suporte no departamento Operacional, podendo receber conversas e atendimentos direcionados a esse departamento.
