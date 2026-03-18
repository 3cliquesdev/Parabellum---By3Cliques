

# Auditoria Final: Resíduos de Lógica Antiga

A lógica principal (flags, barriers, porteiro financeiro, fallback) **já está correta**. Restam apenas **comentários desatualizados** que contradizem a nova regra. Nenhuma lógica funcional precisa mudar.

## Comentários a Corrigir

### 1. Linha 770-772 — `OTP_REQUIRED_KEYWORDS` header
**Atual:** "APENAS SAQUE DE SALDO/CARTEIRA" e "Cancelamentos, reembolsos de pedidos Kiwify NÃO precisam de OTP"
**Correto:** OTP é necessário para ações financeiras que geram ticket (saque + reembolso/estorno). Cancelamento segue sem OTP.

### 2. Linha 1106-1107 — `REFUND_ACTION_PATTERNS` header
**Atual:** "Padrões de REEMBOLSO DE PEDIDO (SEM OTP)"
**Correto:** Remover "(SEM OTP)" — reembolso agora exige OTP quando é ação efetiva.

### 3. Verificação final
Todos os demais usos de `isWithdrawalRequest` são para **logging**, **dynamic labels**, ou **otp_reason dinâmico** — corretos e necessários para distinguir saque de reembolso no contexto.

## Ações
- Atualizar os 2 blocos de comentários acima
- Redeploy da edge function

