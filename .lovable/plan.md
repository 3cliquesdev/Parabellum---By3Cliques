

## Adicionar Eventos Kiwify aos Gatilhos de Email

### Contexto
O backend (webhook Kiwify) ja dispara emails automaticos para varios eventos Kiwify (`order_paid`, `refunded`, `subscription_renewed`, etc.), porem esses gatilhos nao aparecem no dropdown de selecao do Email Builder. Precisamos apenas adicionar as opcoes no frontend.

### O que muda
Adicionar os seguintes gatilhos Kiwify ao dropdown "Gatilho" em **2 arquivos**:

| Valor (trigger_type) | Label no dropdown |
|---|---|
| `order_paid` | Kiwify - Compra Aprovada |
| `upsell_paid` | Kiwify - Upsell Aprovado |
| `subscription_renewed` | Kiwify - Assinatura Renovada |
| `refunded` | Kiwify - Reembolso |
| `churned` | Kiwify - Cancelamento/Churn |
| `cart_abandoned` | Kiwify - Carrinho Abandonado |
| `payment_refused` | Kiwify - Pagamento Recusado |
| `subscription_late` | Kiwify - Assinatura Atrasada |
| `subscription_card_declined` | Kiwify - Cartao Recusado |

### Arquivos afetados

1. **`src/pages/EmailBuilderPage.tsx`** (Builder V1) -- Adicionar os novos itens ao array `TRIGGER_TYPES`
2. **`src/pages/EmailBuilderV2Page.tsx`** (Builder V2) -- Adicionar os novos `SelectItem` ao dropdown de gatilho na sidebar Config

### Impacto
- Zero downgrade: todos os gatilhos existentes permanecem
- O backend ja suporta esses triggers (o webhook Kiwify ja chama `sendTriggeredEmail` com esses valores)
- Basta o usuario criar um template, selecionar o gatilho Kiwify desejado e ativar -- os emails serao disparados automaticamente quando o evento ocorrer

### Detalhes tecnicos

No `EmailBuilderPage.tsx`, expandir o array `TRIGGER_TYPES` com os 9 novos valores listados acima, agrupados visualmente apos os gatilhos existentes.

No `EmailBuilderV2Page.tsx`, adicionar 9 novos `<SelectItem>` correspondentes dentro do `<SelectContent>` do dropdown de gatilho (linhas ~264-274).

