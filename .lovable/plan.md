

# Novo Nó Visual: "Validar Cliente" no Editor de Fluxos

## Objetivo
Criar um nó dedicado `validate_customer` no editor de fluxos, similar ao `fetch_order`, que permite ao montador de fluxo arrastar e usar a validação Kiwify visualmente — com saídas de variáveis e configuração no painel lateral.

## Arquivos a Criar

### 1. `src/components/chat-flows/nodes/ValidateCustomerNode.tsx`
- Nó visual com ícone ShieldCheck, cor verde-esmeralda
- Badges indicando quais campos estão ativos (Telefone, Email, CPF)
- Subtitle mostrando "Validar por: Telefone, Email, CPF"

### 2. `src/components/chat-flows/ValidateCustomerPropertiesPanel.tsx`
- Painel de propriedades lateral (como FetchOrderPropertiesPanel)
- Checkboxes: Telefone, Email, CPF (quais campos usar na validação)
- Variáveis de saída configuráveis:
  - `is_customer` → true/false
  - `customer_name` → Nome encontrado
  - `customer_email` → Email encontrado
- Preview das variáveis disponíveis após execução

## Arquivos a Modificar

### 3. `src/components/chat-flows/nodes/index.ts`
- Adicionar export do `ValidateCustomerNode`

### 4. `src/components/chat-flows/ChatFlowNodeWrapper.tsx`
- Adicionar tipo `validate_customer` ao `ChatFlowNodeType`
- Adicionar cores (verde: `bg-green-700` / `border-green-500`)

### 5. `src/components/chat-flows/ChatFlowEditor.tsx`
- Importar `ValidateCustomerNode` e `ValidateCustomerPropertiesPanel`
- Registrar em `chatFlowNodeTypes`, `blockColors`, `miniMapColors`
- Adicionar defaults no `getDefaultData`
- Adicionar `DraggableBlock` na sidebar (seção Lógica, ícone ShieldCheck, label "Validar Cliente")
- Adicionar renderização do painel de propriedades quando selecionado

### 6. `src/components/chat-flows/variableCatalog.ts`
- Adicionar variáveis de validação (`customer_validated`, `customer_name_found`, `customer_email_found`) similar ao pattern de ORDER_VARS
- Detectar presença de nó `validate_customer` nos ancestrais para disponibilizar variáveis

### 7. `supabase/functions/process-chat-flow/index.ts`
- Adicionar handler para tipo `validate_customer`
- Executar validate-by-kiwify-phone, verify-customer-email, validate-by-cpf conforme campos configurados
- Salvar resultados nas variáveis do fluxo

## Resultado Visual

```text
Sidebar do Editor:
  [Lógica]
    Condição | IA | Pedido | Validar Cliente  ← NOVO

Nó no canvas:
  ┌─────────────────────────┐
  │ 🛡️ Validar Cliente       │ (header verde)
  │ Validar por: Tel, Email  │
  │ [Tel] [Email] [CPF]      │ (badges)
  └─────────────────────────┘

Painel lateral:
  - Campos a validar: ☑ Telefone ☑ Email ☑ CPF
  - Variáveis de saída: is_customer, customer_name...
  - Preview: {{is_customer}} → true/false
```

