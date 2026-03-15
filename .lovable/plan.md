

# Corrigir busca: usar banco MySQL externo em vez da tabela `deals`

## Problema
A edge function `lookup-order-by-tracking` busca na tabela `deals` (CRM), que não é a fonte correta dos pedidos. Os dados reais de pedidos e rastreios estão no banco MySQL externo, acessado pela edge function `fetch-tracking`.

## Solução

### 1. Atualizar `lookup-order-by-tracking/index.ts`
Em vez de consultar a tabela `deals`, reutilizar a lógica do `fetch-tracking` para buscar no MySQL externo:
- Conectar ao MySQL usando as mesmas credenciais (`MYSQL_HOST`, etc.)
- Buscar pelo `tracking_number` nas tabelas `parcel` e `mabang_order`
- Retornar `platform_order_id` (número do pedido), `tracking_number`, `buyer_name` e status
- Manter a mesma interface de resposta (`found`, `external_order_id`, etc.) para não quebrar o frontend

### 2. Atualizar `AdminReturnDialog.tsx`
- Adaptar o `LookupResult` para incluir `buyer_name` do MySQL em vez de dados de `contacts`
- Exibir o nome do comprador (`buyer_name`) quando encontrado
- Manter o fluxo de fallback manual quando não encontrado
- Remover `contact_id` da busca (vem do CRM, não do MySQL)

### Fluxo corrigido
1. Admin cola o rastreio de ida
2. Sistema busca no **banco MySQL externo** (tabelas `parcel` e `mabang_order`)
3. Auto-preenche o `platform_order_id` como número do pedido e exibe nome do comprador
4. Admin preenche os demais campos e cadastra

