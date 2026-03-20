

## Auditoria: Fix de `withdrawal_amount` — Status Atual

### O que JÁ foi aplicado corretamente
1. **Schema da tool `create_ticket`** (linha 7366-7368): `withdrawal_amount` mudou de `number` para `string` ✅
2. **Regras de Extração Tolerante** (linhas 7271-7283): Prompt com exemplos e instrução anti-desistência ✅
3. **Referências `.replace()`** (linhas 8748, 8790, 8816): Usam `args.withdrawal_amount` diretamente como string ✅

### BUG REMANESCENTE — Vai crashar em produção

**Linhas 1171 e 1182** na função `createTicketSuccessMessage()` ainda chamam `.toFixed(2)` no `withdrawalData.amount`, que agora é string:

```typescript
// Linha 1171 — VAI CRASHAR com "todo saldo da carteira".toFixed(2)
valor: withdrawalData.amount.toFixed(2),

// Linha 1182 — MESMO BUG
Valor Solicitado: R$ ${withdrawalData.amount.toFixed(2)}
```

Quando o cliente enviar "todo saldo da carteira", o ticket será criado com sucesso, mas a **mensagem de confirmação vai dar erro de runtime** (`TypeError: toFixed is not a function`), resultando em erro 500 e o cliente não receberá confirmação.

### Plano de Correção

**1 edição em `supabase/functions/ai-autopilot-chat/index.ts`**

Substituir `.toFixed(2)` por lógica que detecta se é numérico:

```typescript
// Helper inline: se for número, formata; se for texto, usa direto
const formatAmount = (val: any) => {
  const num = parseFloat(val);
  return isNaN(num) ? String(val) : num.toFixed(2);
};
```

Aplicar nas linhas 1171 e 1182:
- `valor: formatAmount(withdrawalData.amount)` 
- `Valor Solicitado: R$ ${formatAmount(withdrawalData.amount)}`

**2. Deploy da Edge Function**

### Resultado
- Valor numérico ("150") → exibe "R$ 150.00"
- Valor texto ("todo saldo da carteira") → exibe "R$ todo saldo da carteira"
- Zero crashes, ticket + confirmação funcionam 100%

