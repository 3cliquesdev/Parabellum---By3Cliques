

# Auditoria: Criação de Ticket pela IA — Gaps Encontrados

## Status Geral

| Componente | Status |
|-----------|--------|
| Tool `create_ticket` — definição e parâmetros | ✅ OK |
| HARD GUARD financeiro (OTP check) | ✅ OK — `forbidFinancial && isFinancialTicket && !otpVerified` |
| `otpVerified` propagado no `flow_context` | ✅ OK (corrigido na sessão anterior) |
| `ticketConfig` propagado (dept, assigned_to, category, priority) | ✅ OK |
| Insert no banco com `department_id` e `assigned_to` | ✅ OK — linhas 8114-8115 |
| Email de confirmação após ticket | ✅ OK |
| Internal note estruturada | ✅ OK |
| `useAutopilotTrigger` — propaga `ticketConfig` + `otpVerified` | ✅ OK |

---

## BUG: Variáveis de template NÃO são substituídas (6 de 10 faltando)

O UI oferece **10 variáveis clicáveis** para os templates de assunto e descrição, mas o código de substituição no `ai-autopilot-chat` (linhas 8031-8100) só processa **4**:

| Variável | Subject | Description | Status |
|----------|---------|-------------|--------|
| `{{issue_type}}` | ✅ | ✅ | OK |
| `{{customer_name}}` | ✅ | ✅ | OK |
| `{{order_id}}` | ✅ | ✅ | OK |
| `{{subject}}` | ✅ | — | OK |
| `{{description}}` | — | ✅ | OK |
| `{{customer_email}}` | ❌ | ❌ | **FALTANDO** |
| `{{customer_phone}}` | ❌ | ❌ | **FALTANDO** |
| `{{pix_key}}` | ❌ | ❌ | **FALTANDO** |
| `{{amount}}` | ❌ | ❌ | **FALTANDO** |
| `{{reason}}` | ❌ | ❌ | **FALTANDO** |
| `{{bank}}` | ❌ | ❌ | **FALTANDO** |

**Resultado**: Se o usuário configura o template como `Saque R$ {{amount}} - {{customer_name}}`, o ticket será criado com o texto literal `Saque R$ {{amount}} - João`.

---

## Plano de Correção

### 1. `ai-autopilot-chat/index.ts` — Adicionar 6 variáveis faltantes nos dois blocos de template

Nas linhas 8031-8036 (subject) e 8094-8099 (description), adicionar:

```typescript
.replace(/\{\{customer_email\}\}/g, contact?.email || '')
.replace(/\{\{customer_phone\}\}/g, contact?.phone || '')
.replace(/\{\{pix_key\}\}/g, args.pix_key || '')
.replace(/\{\{amount\}\}/g, args.withdrawal_amount ? `R$ ${args.withdrawal_amount.toFixed(2)}` : '')
.replace(/\{\{reason\}\}/g, args.description || '')
.replace(/\{\{bank\}\}/g, args.bank || '')
```

Os valores vêm de:
- `contact.email` / `contact.phone` — já disponíveis no escopo (contact é carregado antes)
- `args.pix_key` / `args.withdrawal_amount` — já existem como parâmetros da tool
- `args.description` — usado como fallback para `{{reason}}`
- `args.bank` — novo campo (precisa ser adicionado aos parâmetros da tool)

### 2. `ai-autopilot-chat/index.ts` — Adicionar `bank` como parâmetro da tool `create_ticket`

Na definição de parâmetros (linha ~7030), adicionar:

```typescript
bank: {
  type: 'string',
  description: 'Banco informado pelo cliente, se aplicável.'
}
```

### 3. Deploy da edge function

---

## Resumo

Sem esta correção, **6 variáveis** que aparecem como badges clicáveis no painel de configuração serão inseridas nos templates mas **nunca substituídas** pelo valor real, aparecendo como texto bruto `{{variavel}}` no ticket final.

