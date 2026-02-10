
# Unificar Departamentos, Operacoes e Categorias em uma unica pagina com abas

## Resumo

Transformar a pagina `/settings/departments` em uma pagina unificada com **3 abas (Tabs)**: Departamentos, Operacoes e Categorias. O menu lateral "Departamentos" continua no mesmo lugar, mas ao clicar o usuario ve as 3 secoes organizadas por abas.

---

## Etapas

### 1. Renomear item do menu no `routes.ts`

Alterar o titulo de "Departamentos" para **"Departamentos & Operacoes"** (ou similar) no menu lateral, mantendo o mesmo href `/settings/departments` e a mesma permission.

### 2. Criar hooks CRUD para Operacoes e Categorias

**Operacoes** (`src/hooks/useTicketOperations.tsx`):
- Ja existe o hook de query. Adicionar mutations: `useCreateTicketOperation`, `useUpdateTicketOperation`, `useDeleteTicketOperation`.

**Categorias** (`src/hooks/useTicketCategories.tsx`):
- Ja existe query + create. Adicionar: `useUpdateTicketCategory`, `useDeleteTicketCategory`.

### 3. Criar componentes de Dialog para Operacoes e Categorias

- `src/components/OperationDialog.tsx` -- formulario para criar/editar operacao (nome, descricao, cor). Mesmo padrao do `DepartmentDialog`.
- `src/components/CategoryDialog.tsx` -- formulario para criar/editar categoria (nome, descricao, cor). Mesmo padrao.

### 4. Refatorar `src/pages/Departments.tsx` com Tabs

Transformar a pagina em 3 abas usando `@radix-ui/react-tabs`:

```text
[Departamentos]  [Operacoes]  [Categorias]
```

- **Aba Departamentos**: conteudo atual (grid de cards com switch ativo/inativo, editar, deletar)
- **Aba Operacoes**: mesmo layout de cards, usando `useTicketOperations` + CRUD
- **Aba Categorias**: mesmo layout de cards, usando `useTicketCategories` + CRUD

O titulo da pagina muda dinamicamente conforme a aba selecionada, e o botao "Novo" tambem se adapta ("Novo Departamento" / "Nova Operacao" / "Nova Categoria").

### 5. Atualizar titulo na pagina Settings

No `src/pages/Settings.tsx`, atualizar o card que navega para `/settings/departments` com descricao que mencione as 3 secoes.

---

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/config/routes.ts` | Renomear titulo do menu |
| `src/hooks/useTicketOperations.tsx` | Adicionar mutations (create, update, delete) |
| `src/hooks/useTicketCategories.tsx` | Adicionar mutations (update, delete) |
| `src/components/OperationDialog.tsx` | Novo -- dialog CRUD de operacao |
| `src/components/CategoryDialog.tsx` | Novo -- dialog CRUD de categoria |
| `src/pages/Departments.tsx` | Refatorar com Tabs (3 abas) |
| `src/pages/Settings.tsx` | Atualizar descricao do card |

## Impacto

- Zero regressao: a rota `/settings/departments` continua a mesma, nenhum link quebra
- Departamentos continuam funcionando exatamente como antes (primeira aba)
- Operacoes e Categorias ganham CRUD completo (criar, editar, ativar/desativar, deletar)
- As 3 tabelas (`departments`, `ticket_operations`, `ticket_categories`) ja existem com estrutura identica -- apenas falta UI de gestao para operacoes e categorias
