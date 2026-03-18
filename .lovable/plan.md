

# Plano Refinado: OTP Financeiro Baseado em Ação (Ticket) vs Dúvida

## Entendimento

A regra é simples:
- **Dúvidas financeiras** (como funciona saque, prazo de reembolso, explicações) → **SEM OTP, SEM pedir email** — IA responde normalmente
- **Ações financeiras que geram ticket** (solicitar saque, pedir reembolso, pedir estorno) → **COM OTP** — validar identidade antes de criar o ticket

Atualmente o código separa em 3 categorias (saque=OTP, reembolso=sem OTP, cancelamento=sem OTP), mas o correto é: **qualquer ação financeira que resulte em ticket** precisa de OTP.

## O Que Muda

### 1. Nova categoria: `isFinancialActionRequest` (ações que geram ticket)

Criar um novo flag que combina `isWithdrawalRequest` + `isRefundRequest` (reembolso efetivo, estorno) — ou seja, qualquer pedido que vai resultar na criação de um ticket financeiro.

Manter `INFORMATIONAL_PATTERNS` (já existe na linha 1132) como **exclusão explícita**: se a mensagem combinar com padrão informativo ("como funciona", "me explica", "quero saber") → NÃO ativar barreira mesmo que contenha palavra financeira.

```
isFinancialActionRequest = (isWithdrawalRequest || isRefundRequest) 
                          && !isInformationalQuestion
```

### 2. `financialBarrierActive` — Expandir para cobrir ações financeiras

**Linha 6025**: Mudar de `isWithdrawalRequest` para `isFinancialActionRequest`:
```typescript
const financialBarrierActive = isFinancialActionRequest && !hasRecentOTPVerification;
```

### 3. Guard Clause (linha 6272) — Ajustar para `isFinancialActionRequest`

```typescript
if (contactHasEmail && hasEverVerifiedOTP && !isFinancialActionRequest) {
```

### 4. Bloco OTP automático (linha 6296) — Expandir para ações financeiras

```typescript
if (contactHasEmail && isFinancialActionRequest && !hasRecentOTPVerification && !flow_context) {
```

A mensagem de OTP muda de "Verificação de Segurança para Saque" para "Verificação de Segurança" com texto genérico que cobre saque e reembolso.

### 5. Porteiro de Saque (linha 6466-6502) → Porteiro Financeiro

Renomear e expandir para cobrir `isFinancialActionRequest`. Manter a mesma lógica (tem email → OTP direto, sem email → pedir email).

### 6. Handler de Reembolso (linhas 6505-6518) — Remover bypass sem OTP

Atualmente o handler de reembolso diz "NÃO PEÇA OTP". Inverter: reembolso agora segue o mesmo fluxo do porteiro financeiro (OTP obrigatório para ação efetiva).

### 7. `flow_context` presente — Lógica com email cadastrado

Quando `flow_context` está presente (cliente veio pelo menu):
- **Tem email cadastrado + `isFinancialActionRequest`**: Enviar OTP direto ao email e mostrar parcial
- **Sem email + `isFinancialActionRequest`**: Pedir email de compra → validar → se não achou → transferir ao comercial
- **Dúvida financeira (não é ação)**: Atender normalmente sem OTP

### 8. Fallback (linha 7399-7400)

Atualizar fallback para não pedir email em dúvidas:
```typescript
} else if (isFinancialActionRequest) {
  assistantMessage = 'Para prosseguir com sua solicitação financeira, preciso confirmar sua identidade...';
} else if (isFinancialRequest) {
  assistantMessage = 'Posso ajudar com sua dúvida financeira! Como posso ajudar?';
}
```

### 9. Deploy

Redeploiar `ai-autopilot-chat`.

## Resumo da Lógica Final

```text
Cliente fala sobre financeiro:
├── É DÚVIDA? ("como funciona saque", "prazo reembolso", "me explica")
│   └── IA responde normalmente, SEM OTP, SEM pedir email
│
└── É AÇÃO? ("quero sacar", "quero reembolso", "preciso de estorno")
    ├── Tem email cadastrado?
    │   ├── SIM → Enviar OTP → Validar → Criar ticket
    │   └── NÃO → Pedir email → Validar na base
    │       ├── Encontrado → OTP → Ticket
    │       └── Não encontrado → Transferir comercial
    └── Já tem OTP recente? → Prosseguir direto
```

