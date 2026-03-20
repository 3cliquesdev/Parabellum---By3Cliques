

## Diagnóstico Confirmado

O código **ainda não foi alterado**. `withdrawal_amount` continua como `type: 'number'` (linha 7351) e não há instruções no prompt para aceitar texto livre como "todo saldo da carteira".

## Plano de Correção — 3 edições no `ai-autopilot-chat/index.ts` + deploy

### 1. Mudar `withdrawal_amount` de `number` para `string` (linha 7350-7353)

```typescript
withdrawal_amount: {
  type: 'string',
  description: '[APENAS PARA SAQUE] Valor solicitado pelo cliente. Pode ser numérico ("150.00") ou texto livre ("todo saldo", "tudo", "valor total da carteira"). Aceite QUALQUER formato que o cliente usar.'
},
```

### 2. Atualizar referências que usam `.toFixed(2)` (linhas 8732, 8774, 8800)

Como agora é string, substituir `args.withdrawal_amount.toFixed(2)` por `args.withdrawal_amount` diretamente (sem `.toFixed()`), pois pode ser "todo saldo da carteira".

### 3. Adicionar instrução anti-desistência no prompt pós-OTP

Na seção de regras pós-OTP, adicionar:

- Se o cliente usar labels diferentes ("Pix email" → interpretar como chave PIX), extrair pelo contexto
- Se "Valor" for texto livre ("todo saldo", "tudo", "valor total"), usar como `withdrawal_amount` diretamente — NÃO exigir número
- NUNCA responder "Não consegui resolver" após coleta de dados — SEMPRE criar o ticket com o que tem

### 4. Deploy da Edge Function

Após as edições, deploy do `ai-autopilot-chat`.

### Arquivos modificados
- `supabase/functions/ai-autopilot-chat/index.ts` — 3 edições pontuais

