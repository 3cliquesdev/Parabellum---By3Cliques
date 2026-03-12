

# Auditoria OTP Pre-Check — Resultado Completo

## Status: 5 zonas + handler `wait_code` auditados

### Verificado OK

| Item | Status |
|------|--------|
| Zona 1 (Manual, L1373) — scoping, email fallback, lógica | OK |
| Zona 2 (Generic, L2590) — `Deno.env.get()`, email fallback | OK |
| Zona 3 (Auto-advance, L2790) — `Deno.env.get()`, email fallback | OK |
| Zona 4 (Options handler, L3820) — `Deno.env.get()`, email fallback | OK |
| Zona 5 (Master, L5103) — `Deno.env.get()`, `contactData` fallback | OK |
| Handler `wait_code` (L2011) — variáveis em escopo (L1683-84) | OK |
| `NO_CONTENT` set exclui `verify_customer_otp` (L4682) | OK |
| Fallback `ask_email` em todas as 5 zonas | OK |
| Caso `not_customer` → advance + variáveis corretas | OK |

### 3 Problemas Encontrados (menores, mas devem ser corrigidos)

**1. Response body não consumido (resource leak em Deno)**
Todas as 5 zonas fazem `await fetch(...)` para `send-verification-code` mas NÃO consomem o response body. No Deno, isso causa resource leak.

```text
// Atual (5 zonas):
await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-verification-code`, { ... });

// Correto:
const otpRes = await fetch(...);
await otpRes.text(); // consumir body
```

**2. Missing `type: 'customer'` no body do fetch**
O `send-verification-code` aceita `type` (`'employee'` default vs `'customer'`). As 5 zonas enviam `{ email: preEmail }` sem `type`, resultando em branding de "employee" ao invés de "customer" no email OTP.

```text
// Atual:
body: JSON.stringify({ email: preEmail })

// Correto:
body: JSON.stringify({ email: preEmail, type: 'customer' })
```

**3. Sem tratamento de erro no `send-verification-code`**
Se o envio do email falhar, o sistema responde "código enviado" mas nenhum email chega. Devemos ao menos logar o erro.

### Plano de Fix

**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

Em cada uma das 5 zonas, alterar o `fetch` de `send-verification-code` para:

```typescript
const otpSendRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-verification-code`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
  body: JSON.stringify({ email: preEmail, type: 'customer' }),
});
const otpSendBody = await otpSendRes.text();
if (!otpSendRes.ok) {
  console.error('[process-chat-flow] ⚠️ Failed to send OTP:', otpSendBody);
}
```

Total: 5 pontos de edição, ~3 linhas cada. Zero mudança de lógica.

