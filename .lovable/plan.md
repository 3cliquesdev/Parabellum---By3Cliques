

# Filtrar pipelines por departamento do usuário

## Problema
Hoje todos os usuários veem todos os pipelines. A equipe Internacional deveria ver apenas pipelines internacionais, Nacional apenas nacionais, etc. Admins e gerentes continuam vendo tudo.

## Solução

### 1. Banco de dados — Adicionar `department_id` na tabela `pipelines`
- Adicionar coluna `department_id UUID REFERENCES departments(id)` (nullable — pipelines sem departamento ficam visíveis para todos)
- Isso permite vincular cada pipeline a um departamento específico

### 2. Hook `usePipelines` — Filtrar por departamento do usuário
- Buscar o `department` do perfil do usuário logado (já existe na tabela `profiles`)
- Se o usuário tem `hasFullAccess(role)` (admin, manager, general_manager, etc.): retornar **todos** os pipelines (sem filtro)
- Caso contrário: retornar pipelines onde `department_id` é igual ao departamento do usuário **OU** `department_id` é null (pipelines genéricos)

### 3. UI de configuração — Permitir admin/gerente vincular pipeline a departamento
- No `PipelineDialog.tsx` (onde pipelines são criados/editados): adicionar um select de departamento
- Usar o hook `useDepartments` existente para listar departamentos
- Salvar o `department_id` ao criar/atualizar pipeline
- Hooks `useCreatePipeline` e `useUpdatePipeline` passam o novo campo

### 4. Componentes afetados
- **`usePipelines.tsx`** — adicionar lógica de filtro por departamento
- **`useCreatePipeline.tsx`** — aceitar `department_id`
- **`useUpdatePipeline.tsx`** — aceitar `department_id`
- **`PipelineDialog.tsx`** — adicionar select de departamento no form
- **Migração SQL** — adicionar coluna `department_id` à tabela `pipelines`

### Lógica de visibilidade resumida
```text
Admin/Gerente → Vê TODOS os pipelines
Vendedor/Agente → Vê pipelines do SEU departamento + pipelines sem departamento
```

