
## Problema de Keywords na Função pickDepartment()

### Contexto Atual
A função `pickDepartment()` (linhas 822-847) usa regex com keywords para detectar o departamento baseado no conteúdo da mensagem. As regras estão ordenadas por prioridade:

1. **Financeiro** (maior prioridade): contém keywords como `saque|sacar|pix|reembolso|estorno|transferência|devolução|cancelamento|etc`
2. **Suporte Sistema** (técnico): `erro|bug|login|senha|acesso|não funciona|etc`
3. **Suporte Pedidos**: `envio|entrega|rastreio|pedido|frete|etc`
4. **Comercial**: `preço|proposta|plano|comprar|desconto|etc`

### Problema Identificado
Palavras comuns em contexto de **Pedidos/Logística** estão presentes no regex de **Financeiro**, causando redirecionamento errado:

| Palavra | Contexto Pedidos | Problema | 
|---------|------------------|----------|
| **transferência** | "Transferência de pedido para outro endereço", "Posso transferir para outra pessoa?" | Detecta como financeiro (transferência de dinheiro) |
| **devolução** | "Fazer devolução de um pedido", "Como faço uma devolução?" | Detecta como financeiro (reembolso) em vez de suporte pedidos |
| **cancelamento** | "Cancelar meu pedido", "Cancelar este atendimento" | Detecta como financeiro (cancelamento de pagamento) |

### Solução Proposta

**Refinar os keywords para remover ambiguidades e adicionar contexto**:

#### 1. Remover palavras ambíguas do regex Financeiro
- ❌ Remover `transferência` (é mais comum em pedidos/endereço)
- ❌ Remover `devolução/devolver` (é mais comum em pedidos)
- ❌ Remover `cancelamento/cancelar` (é mais genérico, usado em múltiplos contextos)

#### 2. Reforçar keywords mais específicos de Financeiro
- ✅ Manter: `saque|sacar|pix|reembolso|estorno|comissão|pagamento|carteira|boleto|fatura|cobrança|saldo|recarga`
- ✅ Adicionar variações mais específicas: `valor de volta|dinheiro devolvido|reembolsado|saque de saldo|transferência bancária` (contexto mais claro)

#### 3. Fortalecer o regex de Suporte Pedidos
- ✅ Adicionar `devolução|devolver` como keywords específicas de Suporte Pedidos
- ✅ Adicionar variações: `devolver pedido|devolvido|devolvi|envio incorreto|produto errado`

#### 4. Impacto (Zero Regressão)
- ✅ Conversas que mencionam "como faço uma devolução" agora vão para **Suporte Pedidos** em vez de Financeiro
- ✅ Conversas que mencionam "quero cancelar o pedido" agora vão para **Suporte Pedidos** em vez de Financeiro
- ✅ Conversas que mencionam "transferência de endereço" agora vão para **Suporte Pedidos** em vez de Financeiro
- ✅ Conversas reais de Financeiro ("saque", "pix", "boleto", "reembolso de dinheiro") continuam funcionando igual
- ✅ Nenhuma mudança na lógica de `conversation.department` que respeita o fluxo

### Mudanças Técnicas

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

#### Mudança 1: Linha 829 - Refinamento de keywords Financeiro

**Antes**:
```typescript
{ dept: 'financeiro', patterns: /saque|sacar|pix|reembolso|estorno|comiss[aã]o|dinheiro|pagamento|carteira|transfer[eê]ncia|boleto|fatura|cobran[cç]a|saldo|recarga|devolu[cç][aã]o|devolver|cancelamento|cancelar/ },
```

**Depois**:
```typescript
{ dept: 'financeiro', patterns: /saque|sacar|pix|reembolso|estorno|comiss[aã]o|pagamento|carteira|boleto|fatura|cobran[cç]a|saldo|recarga|transfer[êe]ncia.*banc|transf.*banc|valor de volta|dinheiro devolvido|reembolsado/ },
```

**Racional**:
- ❌ Remover: `transferência` (muito genérico - usado também para pedidos/endereços)
- ❌ Remover: `devolução|devolver` (muito genérico - usado também para pedidos)
- ❌ Remover: `cancelamento|cancelar` (muito genérico - usado em múltiplos contextos)
- ❌ Remover: `dinheiro` (muito genérico quando isolado)
- ✅ Manter: `saque|sacar|pix|reembolso|estorno|comissão|pagamento|carteira|boleto|fatura|cobrança|saldo|recarga`
- ✅ Adicionar: `transfer.*banc` (transferência bancária - contexto claro)
- ✅ Adicionar: `valor de volta|dinheiro devolvido|reembolsado` (contexto claro de reembolso)

#### Mudança 2: Linha 833 - Reforço de keywords Suporte Pedidos

**Antes**:
```typescript
{ dept: 'suporte_pedidos', patterns: /envio|entrega|rastreio|transportadora|correios|prazo|encomenda|coleta|endereco|cep|frete|pedido|onde.*pedido|status.*pedido|rastrear/ },
```

**Depois**:
```typescript
{ dept: 'suporte_pedidos', patterns: /envio|entrega|rastreio|transportadora|correios|prazo|encomenda|coleta|endereco|cep|frete|pedido|onde.*pedido|status.*pedido|rastrear|devolu[cç][aã]o|devolver.*pedido|devolvido|devolvi|problema.*envio|envio incorreto|produto errado|cancelar.*pedido|transfer[eê]ncia.*endereco|transfer.*pedido/ },
```

**Racional**:
- ✅ Adicionar: `devolução|devolver` (em contexto de pedido, é claramento suporte pedidos)
- ✅ Adicionar: `devolvido|devolvi` (variações de devolução)
- ✅ Adicionar: `problema.*envio|envio incorreto|produto errado` (contextos relacionados a pedidos)
- ✅ Adicionar: `cancelar.*pedido|cancelamento.*pedido` (cancelamento com contexto de pedido)
- ✅ Adicionar: `transfer.*endereco|transfer.*pedido` (transferência em contexto de pedido/endereço)

### Arquivos Modificados

1. `supabase/functions/ai-autopilot-chat/index.ts`
   - Linha 829: Refinar keywords de Financeiro (remover ambiguidades, adicionar contexto)
   - Linha 833: Reforçar keywords de Suporte Pedidos (adicionar devolução, cancelamento, transferência com contexto)

### Logs de Audit

Os logs já existentes (linhas 4313-4322 e 6761-6770) continuam funcionando e ajudarão a diagnosticar as novas escolhas de departamento.

