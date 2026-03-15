

# Busca por rastreio de ida no cadastro admin de devolução

## Contexto
Quando um pedido volta como devolução, geralmente vem identificado pelo código de rastreio original (de ida). O admin precisa buscar o pedido pelo tracking code para preencher automaticamente o `external_order_id` e dados do pedido.

## Mudanças

### 1. Edge Function `lookup-order-by-tracking` (nova)
- Recebe `tracking_code` (string)
- Busca na tabela `deals` por `tracking_code` correspondente
- Retorna `external_order_id`, `tracking_code`, `contact_id` e dados do contato (nome, email)
- Usa service role key, CORS padrão

### 2. `AdminReturnDialog.tsx`
- Trocar campo principal de "Número do Pedido" para **"Rastreio de Ida"** como primeiro campo
- No `onBlur` do campo de rastreio, chamar a edge function para buscar o deal
- Quando encontrado: preencher automaticamente o `external_order_id` (read-only) e exibir info do cliente
- Quando não encontrado: mostrar mensagem e permitir preenchimento manual do `external_order_id`
- Manter os demais campos (rastreio devolução, motivo, descrição, status)

### 3. `useReturns.ts`
- Atualizar `useCreateAdminReturn` para aceitar `tracking_code_original` no insert

### Fluxo do admin
1. Admin digita/cola o rastreio de ida
2. Sistema busca o deal correspondente
3. Auto-preenche número do pedido e dados do cliente
4. Admin preenche rastreio reverso, motivo, descrição e status
5. Cadastra a devolução

