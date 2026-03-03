
Analisei o projeto atual e sigo as regras da base de conhecimento.

## Objetivo

Permitir que ao clicar no nome/linha de um atendente na sidebar do Inbox, as conversas sejam filtradas para mostrar apenas as daquele agente. Atualmente a seção "Por Atendente" exibe stats e ações (redistribuir, mudar status), mas **não filtra a lista de conversas**.

## Plano

### 1. Adicionar filtro por agente na URL (`InboxSidebar.tsx`)

- Adicionar parâmetro `agent` nos search params (similar a `dept` e `tag`).
- Tornar a linha do agente clicável para ativar/desativar o filtro `?agent=<agentId>`.
- Highlight visual quando o agente está selecionado (mesmo padrão de departamento/tag).

### 2. Aplicar filtro na query de conversas

- No hook/componente que busca conversas do inbox, ler o param `agent` e adicionar `.eq("assigned_to", agentId)` na query.
- Arquivo provável: o componente que consome a lista de conversas (preciso verificar qual hook é usado).

### 3. Exibir indicador de filtro ativo

- Quando filtro por agente está ativo, mostrar o nome do agente no topo da lista ou como breadcrumb para facilitar a remoção do filtro.

### Arquivos a editar
- `src/components/inbox/InboxSidebar.tsx` — tornar agentes clicáveis com filtro URL
- Hook/componente de listagem do inbox — aplicar filtro `assigned_to`

### Impacto
- Sem regressão: filtros existentes (dept, tag, status) continuam funcionando.
- Apenas frontend, sem mudança em backend.
