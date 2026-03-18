

# Pipeline padrão por vendedor

## Problema
Hoje o pipeline padrão é global (`is_default` na tabela `pipelines`). A Thaynara do time Comercial vê o pipeline "Vendas - Internacional & Global" quando deveria ver o do seu departamento por padrão.

## Solução

### 1. Migration — Adicionar coluna `default_pipeline_id` na tabela `profiles`
- Nova coluna `default_pipeline_id UUID` nullable, com FK para `pipelines(id)` e `ON DELETE SET NULL`
- RLS: usuário autenticado pode atualizar seu próprio `default_pipeline_id`

### 2. `Deals.tsx` — Usar preferência do usuário
- No `useEffect` que seleciona o pipeline inicial, checar se o `profile` do usuário tem `default_pipeline_id` definido
- Hierarquia: **preferência do usuário** → pipeline global padrão (`is_default`) → primeiro da lista

### 3. UI para definir pipeline padrão pessoal
- No seletor de pipeline da página de Deals, adicionar uma ação "Definir como meu padrão" (ícone de estrela ou pin ao lado do select)
- Ao clicar, salva o pipeline selecionado como `default_pipeline_id` no perfil do usuário
- Feedback visual: toast de confirmação + indicador sutil no select

### 4. Hook `useSetDefaultPipeline`
- Mutation que atualiza `profiles.default_pipeline_id` para o usuário logado
- Invalida queries de profile

### Arquivos a alterar
- Migration SQL (nova coluna + RLS)
- `src/pages/Deals.tsx` — lógica de seleção inicial + botão "meu padrão"
- Novo: `src/hooks/useSetDefaultPipeline.ts`
- `src/hooks/useAuth.tsx` ou query de profile — buscar `default_pipeline_id`

