

# Vincular contatos existentes do Inbox com base Kiwify por telefone

Analisei o projeto atual e sigo as regras da base de conhecimento.

## O que será feito

Criar uma Edge Function **`batch-validate-kiwify-contacts`** que:

1. Busca todos os contatos com `kiwify_validated IS NULL OR kiwify_validated = false` que possuem `phone` ou `whatsapp_id` preenchido
2. Para cada contato, compara os últimos 9 dígitos do telefone contra o campo `payload->Customer->>'mobile'` da tabela `kiwify_events` (eventos `paid`, `order_approved`, `subscription_renewed`)
3. Se encontrar match, atualiza o contato: `kiwify_validated = true`, `status = 'customer'`, `kiwify_validated_at = now()`, e preenche email se disponível
4. Retorna relatório: quantos validados, quantos não encontrados

A lógica de matching já existe em `validate-by-kiwify-phone` — será reutilizada inline (mesma normalização de últimos 9 dígitos).

## Execução

Após deploy, será invocada uma única vez para processar o backlog. Resultado: todas as conversas no Inbox cujo telefone tem compra Kiwify receberão o selo "Cliente" automaticamente.

### Arquivos

- **Criar**: `supabase/functions/batch-validate-kiwify-contacts/index.ts` — Edge Function que faz o batch processing
- Nenhuma alteração em arquivos existentes

### Sem risco de regressão
- Função isolada, executada sob demanda
- Usa a mesma lógica de matching já validada (`últimos 9 dígitos`)
- Apenas atualiza contatos que ainda não são `kiwify_validated`

