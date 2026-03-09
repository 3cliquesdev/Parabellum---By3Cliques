

# Plano: Gestão Dinâmica de Categorias de Ticket

## Resumo
Criar página `/settings/ticket-categories` seguindo a mesma estrutura da página de Tags (`Tags.tsx` + `TagDialog.tsx`), e substituir os dropdowns hardcoded no editor de fluxo por dados dinâmicos da tabela `ticket_categories`.

## O que já existe
- Tabela `ticket_categories` no banco (id, name, description, color, priority, is_active)
- Hooks CRUD completos em `useTicketCategories.tsx` (query, create, update, delete)
- Categorias **hardcoded** em 3 locais: `ChatFlowEditor.tsx` (2x), `CreateTicketNode.tsx`, `TicketNotificationRulesSettings.tsx`

## Componentes a criar/editar

### 1. Nova página `TicketCategoriesSettings.tsx`
- Mesma estrutura de `Tags.tsx`: tabela com nome, cor (badge), descrição, prioridade padrão, status ativo/inativo, botões editar/excluir
- Botão "Nova Categoria"
- AlertDialog de confirmação para exclusão

### 2. Novo componente `TicketCategoryDialog.tsx`
- Mesma estrutura de `TagDialog.tsx`: dialog com campos nome, cor (ColorPicker), descrição, prioridade padrão
- Usa hooks `useCreateTicketCategory` e `useUpdateTicketCategory`

### 3. Rota em `App.tsx`
- Adicionar `/settings/ticket-categories` com permissão `settings.view`

### 4. Tornar dropdowns dinâmicos
- **`ChatFlowEditor.tsx`** (2 blocos, linhas ~1122-1135 e ~1229-1243): substituir `<SelectItem>` hardcoded por `useTicketCategories()` + `.map()`
- **`CreateTicketNode.tsx`** (labels no nó visual): buscar labels da query ou manter fallback do `name` da categoria
- **`TicketNotificationRulesSettings.tsx`** (linhas 27-35): substituir array `TICKET_CATEGORIES` por `useTicketCategories()`

### 5. Seed inicial
- Inserir as categorias atuais hardcoded na tabela `ticket_categories` para não perder dados existentes (financeiro, tecnico, bug, devolucao, reclamacao, saque, outro)

## Impacto
- Zero alteração no motor de fluxos (engine usa o valor string salvo no nó)
- Upgrade puro: categorias passam a ser gerenciáveis pelo admin
- Fallback seguro: se a query falhar, dropdown fica vazio mas não quebra

