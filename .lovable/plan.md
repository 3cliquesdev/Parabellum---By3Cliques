

# Múltiplos Gatilhos por Template de Email

## Problema Atual
Cada template de email aceita apenas **um** `trigger_type` (string). Se o usuário quer que o mesmo template dispare em "churned" **e** "refunded", precisa duplicar o template.

## Solução

### 1. Migração do Banco de Dados
- Adicionar coluna `trigger_types text[]` na tabela `email_templates`
- Migrar dados existentes: copiar valor de `trigger_type` para `trigger_types` como array de 1 elemento
- Manter `trigger_type` temporariamente para compatibilidade (pode ser removido depois)

### 2. Frontend — Multi-select com Checkboxes
- No `EmailTemplateDialog.tsx`: substituir o `<Select>` único por uma lista de checkboxes (ou dropdown multi-select) onde o usuário marca múltiplos gatilhos
- No `CreateTemplateV2Dialog.tsx`: mesma mudança
- Salvar como array `trigger_types` no banco

### 3. Backend — Edge Functions
- **`send-triggered-email`**: alterar query de `.eq("trigger_type", trigger_type)` para `.contains("trigger_types", [trigger_type])` — busca templates cujo array contém o gatilho disparado
- **`get-email-template`**: mesma alteração
- **`kiwify-webhook`**: sem mudança (já passa o trigger como string, o backend resolve)

### 4. Hooks e Types
- Atualizar `useEmailTemplates`, `useCreateEmailTemplate`, `useUpdateEmailTemplate` para trabalhar com `trigger_types: string[]`
- Atualizar tipos em `emailBuilderV2.ts`

## Impacto
- **Zero regressão**: dados existentes migrados automaticamente
- **Backward-compatible**: templates com 1 gatilho continuam funcionando
- **Importante**: quando um evento dispara, pode encontrar **múltiplos templates** ativos — o `send-triggered-email` precisará usar `.select()` sem `.single()` e iterar para enviar todos

## Arquivos Modificados
| Arquivo | Mudança |
|---|---|
| Migration SQL | Nova coluna + migração de dados |
| `src/components/EmailTemplateDialog.tsx` | Multi-select de gatilhos |
| `src/components/email-builder-v2/CreateTemplateV2Dialog.tsx` | Multi-select de gatilhos |
| `supabase/functions/send-triggered-email/index.ts` | Query com `contains` |
| `supabase/functions/get-email-template/index.ts` | Query com `contains` |
| `src/hooks/useEmailTemplates.tsx` | Suporte a `trigger_types[]` |
| `src/hooks/useCreateEmailTemplate.tsx` | Suporte a `trigger_types[]` |
| `src/hooks/useUpdateEmailTemplate.tsx` | Suporte a `trigger_types[]` |

