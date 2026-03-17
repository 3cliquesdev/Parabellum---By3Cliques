

# Auto-busca por Bipe (Scanner de Código de Barras) no Formulário de Devoluções

## Contexto
O scanner de código de barras (bipe) digita o texto rapidamente e envia **Enter** no final. Hoje, o campo "Rastreio de Ida" só busca no **blur** (perder foco), o que não funciona bem com o bipe. Além disso, o campo "Número do Pedido" não faz nenhuma busca reversa.

## Alterações

### 1. Frontend — `AdminReturnDialog.tsx`

**Campo "Rastreio de Ida":**
- Adicionar `onKeyDown` que detecta **Enter** e dispara a busca automaticamente (igual ao blur)
- Isso faz o bipe funcionar: escaneia → texto entra → Enter → busca automática

**Campo "Número do Pedido":**
- Adicionar busca reversa no `onKeyDown` (Enter) e `onBlur`
- Quando o operador digita/escaneia um número de pedido, buscar no MySQL por `platform_order_id` para preencher automaticamente o rastreio, seller e produtos

### 2. Backend — Nova Edge Function `lookup-order-by-id`

Criar uma edge function que faz a busca reversa: dado um `platform_order_id`, consulta o MySQL para retornar:
- `tracking_code` (rastreio de ida)
- `buyer_name` (seller)
- `product_items` (produto + SKU)

Reutiliza a mesma estrutura da `lookup-order-by-tracking`, mas busca por `platform_order_id` em vez de `track_number`.

### Fluxo final

```text
Bipe escaneia rastreio → Enter → busca por tracking → preenche pedido, seller, produtos
       OU
Bipe escaneia pedido  → Enter → busca por order_id → preenche rastreio, seller, produtos
```

Ambos os campos se complementam: qualquer um que for preenchido primeiro busca e preenche o outro automaticamente.

### Resumo técnico
- **1 arquivo frontend editado**: `AdminReturnDialog.tsx` (onKeyDown + busca reversa no campo pedido)
- **1 nova edge function**: `lookup-order-by-id` (busca MySQL por platform_order_id)
- Zero alterações no banco de dados

