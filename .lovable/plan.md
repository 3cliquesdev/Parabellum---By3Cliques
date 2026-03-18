

# Auditoria Completa: Criação de Ticket pela IA + OTP

## Resultado Geral

| Componente | Status |
|-----------|--------|
| Tool `create_ticket` — parâmetros (incluindo `bank`) | ✅ OK |
| HARD GUARD financeiro (OTP check) | ✅ OK |
| Template subject — 10 variáveis substituídas | ✅ OK |
| Template description — 10 variáveis substituídas | ✅ OK |
| Insert no DB com `department_id` + `assigned_to` | ✅ OK |
| Email de confirmação pós-ticket | ✅ OK |
| Internal note estruturada (com dados de saque) | ✅ OK |
| Link conversation → ticket | ✅ OK |
| `ticketCreatedSuccessfully` flag anti-duplicação | ✅ OK |
| Web chat (`useAutopilotTrigger`) — propaga `otpVerified` + `ticketConfig` | ✅ OK (linhas 89-91) |

---

## BUG CRÍTICO: 3 webhooks NÃO propagam `ticketConfig` e `otpVerified`

Quando `process-chat-flow` retorna dados ao webhook, TODOS os campos vêm no **nível raiz** (ex: `flowData.ticketConfig`, `flowData.otpVerified`). Os webhooks constroem um `flow_context` manualmente como fallback, mas **omitem esses dois campos**.

### Arquivos afetados:

**1. `meta-whatsapp-webhook/index.ts` (linhas 1218-1238)**
O fallback em `flow_context: flowData.flow_context || { ... }` não inclui:
- `ticketConfig`
- `otpVerified`
- `forbidSupport`

**2. `handle-whatsapp-event/index.ts` (linhas 1305-1324)**
Mesmo problema — fallback idêntico, faltam:
- `ticketConfig`
- `otpVerified`

**3. `process-buffered-messages/index.ts` (linhas 363-380)**
Fallback `flowData` → `flow_context` falta:
- `ticketConfig`
- `otpVerified`
- `forbidCancellation`
- `forbidConsultant`
- `forbidSupport`

### Impacto
- **`ticketConfig` ausente**: A IA cria tickets sem respeitar o departamento, responsável, categoria e templates configurados no nó do fluxo. Usa valores default genéricos.
- **`otpVerified` ausente**: O HARD GUARD financeiro **sempre bloqueia** tickets financeiros via WhatsApp, mesmo quando o OTP foi verificado com sucesso, porque `flow_context.otpVerified` é sempre `undefined` (falsy).

### Correção (3 arquivos)

Adicionar nas 3 construções de fallback:

```typescript
ticketConfig: flowData.ticketConfig || null,
otpVerified: flowData.otpVerified || false,
```

E no `process-buffered-messages`, adicionar também:
```typescript
forbidCancellation: flowData.forbidCancellation ?? false,
forbidConsultant: flowData.forbidConsultant ?? false,
forbidSupport: flowData.forbidSupport ?? false,
```

### Deploy
Redeploy das 3 edge functions: `meta-whatsapp-webhook`, `handle-whatsapp-event`, `process-buffered-messages`.

