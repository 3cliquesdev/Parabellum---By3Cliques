

# Correção: IA Financeiro ignora objetivo do nó quando detecta "reembolso"

## Diagnóstico da conversa #832496F2

**Timeline:**
- Cliente escolheu "Financeiro, reembolso e saque" no menu → roteado para `node_ia_financeiro`
- IA deu resposta genérica sobre custos/pagar pedido (1ª interação)
- Cliente escreveu "Reembolso" e "Resposta do reembolso já solicitado"
- IA respondeu "Para consultar o status do seu pedido, preciso do número do pedido ou código de rastreio" ❌
- Deveria ter coletado dados (PIX, banco, motivo, valor) e criado ticket conforme objetivo do nó

**Causa raiz:** O handler `isRefundRequest` (linha 6522-6534 do `ai-autopilot-chat`) injeta uma instrução genérica no prompt dizendo "reembolsos são automáticos, não precisa cobrar". Essa instrução **sobrescreve** o objetivo do nó `node_ia_financeiro` que manda coletar dados e criar ticket. A IA fica confusa entre o objetivo do nó (coletar PIX/banco/valor) e a instrução do handler (dizer que é automático), e acaba pedindo número de pedido (influenciada pelos artigos KB de logística).

## Correção

### Arquivo: `supabase/functions/ai-autopilot-chat/index.ts`

**Linhas 6522-6534** — Condicionar o handler de reembolso para NÃO injetar quando o cliente já está no nó financeiro:

```typescript
// HANDLER PARA REEMBOLSO (SEM OTP)
// NÃO injetar quando já está no nó financeiro (o objetivo do nó já cuida)
if (isRefundRequest && !isWithdrawalRequest && !flow_context?.currentNodeId?.includes('financeiro')) {
  // ... handler existente (sem alteração)
}
```

Quando o cliente está no `node_ia_financeiro`, o objetivo do nó já instrui a IA a "identificar tipo (saque/reembolso), coletar dados completos e criar ticket". Sem a instrução conflitante do handler, a IA seguirá o objetivo corretamente.

## Impacto
- Clientes no nó financeiro que pedem reembolso terão os dados coletados e ticket criado (comportamento correto)
- Clientes em OUTROS nós (ex: dúvidas gerais, pedidos) que mencionam reembolso continuam recebendo a explicação genérica (sem regressão)
- Zero risco — é apenas um condicional adicional no guard existente

