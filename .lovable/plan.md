

# Auto-preencher rastreio original + campo de rastreio reverso opcional

## O que será feito

Quando o cliente digitar o número do pedido no formulário de devolução, o sistema buscará automaticamente o código de rastreio original associado (via edge function `register-return` que já faz essa busca). O rastreio original será exibido como campo somente leitura no formulário. O campo de rastreio reverso (devolução) permanece opcional.

## Alterações

### 1. Busca automática de rastreio ao digitar pedido (`NewReturnDialog.tsx`)
- Adicionar state `trackingOriginal: string` e `loadingTracking: boolean`
- Ao sair do campo "Número do Pedido" (`onBlur`) ou após debounce, chamar a edge function `register-return` com um novo endpoint ou criar uma nova edge function leve `lookup-order-tracking` que:
  - Recebe `email` + `external_order_id`
  - Busca o deal pelo `external_order_id` (e `contact_id` se encontrado)
  - Retorna `{ tracking_code_original: string | null }`

**Decisão**: Criar edge function separada `lookup-order-tracking` para não poluir o `register-return` com lógica de preview.

### 2. Nova edge function `lookup-order-tracking/index.ts`
- `verify_jwt = false`
- Recebe `{ email, external_order_id }`
- Busca contact pelo email → busca deal pelo `external_order_id` (+ `contact_id` se houver)
- Retorna `{ tracking_code_original: string | null }`
- Leve, rápida, sem efeitos colaterais

### 3. UI no formulário (`NewReturnDialog.tsx`)
- Após o campo "Número do Pedido", ao `onBlur` (se `orderId` e `email` preenchidos):
  - Chamar `lookup-order-tracking`
  - Se retornar rastreio, exibir campo read-only com ícone de check: "Rastreio do envio: XX123456BR"
  - Se não encontrar, mostrar texto discreto: "Rastreio não localizado automaticamente"
- Campo "Código de Rastreio da Devolução (opcional)" permanece editável como já está
- Passar `tracking_code_original` no submit para `register-return` (campo informativo, o backend já faz a busca própria)

### 4. Atualizar `supabase/config.toml`
- Adicionar entrada para `lookup-order-tracking` com `verify_jwt = false`

## Fluxo
```text
Cliente preenche email + nº pedido → onBlur → lookup-order-tracking
                                              ↓
                                   Retorna tracking_code_original
                                              ↓
                              Exibe "Rastreio do envio: XX..." (read-only)
                              Campo "Rastreio reverso" continua opcional
                                              ↓
                              Submit → register-return (já salva tudo)
```

