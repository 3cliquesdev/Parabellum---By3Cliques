

# Melhorias na Importação de Deals

## Problemas identificados pelo usuário

1. **Template incompleto** — falta "Nome do Cliente" como campo mapeável; os campos atuais não refletem o que o time realmente precisa
2. **Mapeamento de colunas já existe** — mas precisa incluir o campo "Nome do Cliente"
3. **Permissão restrita** — hoje usa `deals.create`, mas precisa ser acessível para admins E gerente de vendas (já coberto por `hasFullAccess` que inclui `manager`, mas o `sales_rep` com permissão `deals.create` também acessa — o que pode não ser desejado)

## Mudanças planejadas

### 1. Adicionar campo "Nome do Cliente" ao mapeamento e importação
- **DealColumnMapper**: Adicionar campo `nome_cliente` (Nome do Cliente) na lista de campos mapeáveis
- **Auto-mapping**: Adicionar aliases como `cliente`, `nome_cliente`, `customer`, `nome do cliente`
- **Edge Function `import-deals`**: Usar `nome_cliente` para buscar/criar contato (além de email/telefone). Se `nome_cliente` estiver presente mas email não, criar contato com `first_name` baseado no nome
- **Template download**: Atualizar headers para incluir "Nome do Cliente" como primeira coluna, reordenar para: Nome do Cliente, Título, Valor, Email, Telefone, Vendedor, Data Fechamento

### 2. Atualizar template de download (.xlsx)
Nova ordem de colunas:
`Nome do Cliente` | `Título do Deal` | `Valor` | `Email Contato` | `Telefone` | `Vendedor` | `Data Prevista Fechamento` | `Produto` | `Fonte` | `Status`

### 3. Ajustar permissão da rota
- Alterar a rota `/import-deals` no `App.tsx` para usar `requiredPermission="deals.import"` ou manter `deals.create` — os roles com `hasFullAccess` (admin, manager, general_manager, etc.) já têm acesso total
- Se necessário, adicionar permissão específica `deals.import` na tabela `role_permissions` para o role `manager` — mas como `FULL_ACCESS_ROLES` já inclui `manager`, isso já funciona

### Arquivos a editar
- `src/components/DealColumnMapper.tsx` — adicionar campo `nome_cliente`
- `src/pages/ImportDeals.tsx` — atualizar auto-mapping aliases e template download
- `supabase/functions/import-deals/index.ts` — aceitar `nome_cliente` e usar para criar/buscar contato

