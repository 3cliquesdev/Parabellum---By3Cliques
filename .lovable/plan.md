

# Produto Manual + Campos Opcionais + Validação de Rastreio

## Mudanças no `AdminReturnDialog.tsx`

### 1. Campos de Produto/SKU sempre visíveis
- Adicionar estado `manualProducts` (array de `{title, sku}`) 
- Quando lookup encontra, preencher automaticamente e mostrar como readonly
- Quando NÃO encontra (ou sem busca), mostrar campos editáveis para preenchimento manual
- Botão "Adicionar produto" para múltiplos itens manuais

### 2. Seller editável manualmente
- Adicionar campo `sellerName` (string) — preenchido automaticamente pelo lookup, mas editável sempre
- Quando lookup não encontra, campo fica vazio e editável

### 3. Campos opcionais
- Remover obrigatoriedade do "Número do Pedido" (hoje é `*` obrigatório)
- Seller, Rastreio de Ida, Número do Pedido e Rastreio Devolução ficam todos opcionais
- Só "Motivo" continua obrigatório
- Atualizar `handleSubmit`: validar apenas `reason`, enviar produto/seller como metadata

### 4. Validação: Rastreio Devolução ≠ Rastreio Ida
- Ao preencher o campo "Rastreio Devolução", comparar com `trackingOriginal`
- Se forem iguais, exibir alerta: "O código de devolução deve ser o código de reversa, não o mesmo da ida"
- Bloquear submit enquanto forem iguais

### 5. Enviar dados de produto no submit
- Incluir `product_items` e `seller_name` no payload do `createReturn.mutateAsync`
- Prioridade: dados do lookup > dados manuais (se ambos existirem, lookup prevalece)

## Arquivo modificado
- `src/components/support/AdminReturnDialog.tsx`

