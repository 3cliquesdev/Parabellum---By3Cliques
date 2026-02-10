
# Auto-preencher Prioridade ao selecionar Categoria no Formulario

## Resumo

Quando o admin seleciona uma **Categoria Padrao** nas Configuracoes de Ticket do formulario, a **Prioridade Padrao** sera preenchida automaticamente com a prioridade definida nessa categoria (tabela `ticket_categories`). O admin ainda pode alterar manualmente depois.

## Problema atual

- As categorias no `TicketFieldMapping` sao **hardcoded** (`financeiro`, `tecnico`, `bug`, `outro`) e nao vem do banco
- Nao ha vinculo entre a categoria selecionada e sua prioridade cadastrada
- No `CategoryDialog` (criacao manual de ticket), isso ja funciona porque o admin define a prioridade junto

## O que muda

### 1. Buscar categorias do banco (em vez de hardcoded)

**Arquivo:** `src/components/forms/TicketFieldMapping.tsx`

- Importar `useTicketCategories` de `src/hooks/useTicketCategories.tsx`
- Remover o array `CATEGORY_OPTIONS` hardcoded
- Usar as categorias reais do banco no Select de "Categoria Padrao"

### 2. Auto-preencher prioridade ao trocar categoria

**Arquivo:** `src/components/forms/TicketFieldMapping.tsx`

- No `onValueChange` do Select de categoria:
  - Buscar a categoria selecionada na lista carregada
  - Se ela tiver `priority`, atualizar `default_priority` automaticamente
  - Chamar `onChange({ ...settings, default_category: v, default_priority: cat.priority })`

### 3. Atualizar tipo de `default_category`

**Arquivo:** `src/hooks/useForms.tsx`

- Alterar `default_category` de tipo union literal (`"financeiro" | "tecnico" | ...`) para `string`, ja que agora os valores vem do banco (IDs ou nomes dinamicos)

## Arquivos modificados

| Arquivo | Mudanca |
|---|---|
| `src/components/forms/TicketFieldMapping.tsx` | Carregar categorias do banco, auto-preencher prioridade ao selecionar |
| `src/hooks/useForms.tsx` | Tipo de `default_category` para `string` |

## Impacto

- Zero regressao: categorias existentes continuam funcionando
- O Select de categoria agora reflete o que realmente existe no sistema
- Prioridade e preenchida automaticamente mas pode ser alterada manualmente
- Formularios ja salvos com categorias antigas continuam validos (string e compativel)
