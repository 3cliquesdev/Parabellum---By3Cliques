

# Importação de Deals via Planilha

## Objetivo
Criar uma página `/import-deals` que permita importar negócios (deals) em massa via CSV/Excel, seguindo o mesmo padrão arquitetural do `/import-clients` existente.

## Fluxo do Usuário

```text
1. Upload CSV/Excel (reutiliza CSVUploader)
2. Mapear colunas → campos do deal
3. Selecionar Pipeline + Estágio destino
4. Preview dos dados mapeados
5. Processar importação (Edge Function)
6. Exibir resultado (criados, erros, duplicados)
```

## Campos Mapeáveis da Planilha

| Campo obrigatório | Campos opcionais |
|---|---|
| `title` (título do deal) | `value`, `email_contato`, `telefone_contato` |
| `pipeline` (seletor na UI) | `produto`, `assigned_to` (email do vendedor) |
| `stage` (seletor na UI) | `expected_close_date`, `external_order_id` |
| | `lead_source`, `status` |

## Implementação

### 1. Nova página `src/pages/ImportDeals.tsx`
- Reutiliza `CSVUploader` para parsing
- Reutiliza `ColumnMapper` para mapeamento de colunas
- Seletores de Pipeline e Estágio (carregados do banco)
- Seletor opcional de vendedor padrão (assigned_to)
- Preview tabular antes de importar

### 2. Nova Edge Function `supabase/functions/import-deals/index.ts`
- Recebe array de deals mapeados + pipeline_id + stage_id
- Para cada linha:
  - Busca/cria contato pelo email (reutiliza lógica do upsert-contact)
  - Cria o deal vinculado ao contato, pipeline e estágio
  - Resolve `assigned_to` por email do vendedor → UUID do profile
  - Resolve `product_id` por nome do produto
- Cria um `sync_job` para tracking de progresso
- Retorna contagem de deals criados, erros e contatos criados

### 3. Rota e navegação
- Adicionar rota `/import-deals` no router
- Adicionar botão de acesso na área de deals ou no Super Admin

### 4. Hook `useImportDeals.tsx`
- Mutation que invoca a Edge Function
- Tracking de progresso via `useSyncJob`

## Segurança
- Edge Function valida autenticação
- Verifica `organization_id` do usuário
- RLS existente nos deals já protege os dados

