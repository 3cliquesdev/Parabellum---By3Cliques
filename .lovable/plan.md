

# Auditoria: Lógica de Criação de Ticket pela IA + OTP

## Estado Geral

| Componente | Status |
|-----------|--------|
| UI `AIResponsePropertiesPanel` — seção "Criar Ticket" | ✅ OK — toggle, departamento, categoria, prioridade, templates |
| `ai-autopilot-chat` — tool `create_ticket` | ✅ OK — consome `ticketConfig`, gera nota interna, envia email |
| `ai-autopilot-chat` — HARD GUARD financeiro | ✅ OK — bloqueia ticket financeiro sem OTP |
| `ai-autopilot-chat` — instruções no system prompt | ✅ OK — IA sabe quando usar `create_ticket` |
| `process-chat-flow` — propaga `ticketConfig` | ✅ OK — presente em 8 pontos de resposta |
| `useAutopilotTrigger` — propaga `ticketConfig` | ✅ OK — linha 83 |

---

## BUG CRÍTICO: `otpVerified` NÃO é propagado em 7 de 8 pontos

O campo `otpVerified` só é incluído na resposta JSON em **1 ponto** (linha 3803 do `process-chat-flow`). Os outros **7 pontos** que retornam `useAI: true` com `ticketConfig` **NÃO incluem `otpVerified`**.

**Resultado**: Mesmo após o cliente validar OTP, a IA recebe `otpVerified: undefined` na maioria dos caminhos. Consequências:
1. O system prompt NÃO injeta a instrução "✅ CLIENTE VERIFICADO POR OTP"
2. O HARD GUARD bloqueia tickets financeiros legítimos (linha 7958: `!flow_context?.otpVerified`)
3. A IA pede OTP novamente mesmo quando já foi validado

### Pontos afetados (faltando `otpVerified`):
- Linha 2094 — transição OTP genérico → IA
- Linha 2324 — transição OTP auto-advance → IA  
- Linha 2511 — transição OTP options handler → IA
- Linha 2926 — transição ask_options → IA (inline JSON)
- Linha 4581 — transição padrão → IA
- Linha 5476 — bootstrap do fluxo → IA
- Linha 5813 — trigger inicial → IA

### Segundo BUG: `useAutopilotTrigger` não propaga `otpVerified`

Linha 66-84: o `flowContext` construído no frontend inclui `ticketConfig` mas **não inclui** `otpVerified`, `forbidFinancial`, `forbidCommercial`, etc. Esses campos ficam perdidos entre o `process-chat-flow` e o `ai-autopilot-chat`.

---

## Plano de Correção

### 1. `process-chat-flow/index.ts` — Adicionar `otpVerified` em todos os 7 pontos faltantes

Em cada resposta JSON que contém `ticketConfig`, adicionar:
```
otpVerified: collectedData?.__ai_otp_verified === true,
```

### 2. `useAutopilotTrigger.tsx` — Propagar campos de controle faltantes

No objeto `flowContext` (linhas 66-84), adicionar:
```typescript
otpVerified: data?.otpVerified || false,
forbidFinancial: data?.forbidFinancial ?? false,
forbidCommercial: data?.forbidCommercial ?? false,
forbidCancellation: data?.forbidCancellation ?? false,
forbidSupport: data?.forbidSupport ?? false,
forbidConsultant: data?.forbidConsultant ?? false,
```

### 3. Deploy

Deploy de `process-chat-flow`.

---

## Resumo do Fluxo Completo (quando tudo estiver corrigido)

```text
Cliente pede saque
  → process-chat-flow: roteia para nó financeiro
  → nó OTP: coleta email → envia código → valida
  → collectedData.__ai_otp_verified = true
  → process-chat-flow retorna: { useAI: true, otpVerified: true, ticketConfig: {...} }
  → useAutopilotTrigger: monta flowContext com otpVerified: true
  → ai-autopilot-chat:
    - System prompt inclui "✅ CLIENTE VERIFICADO POR OTP"
    - HARD GUARD permite create_ticket financeiro
    - IA coleta dados (valor, chave PIX)
    - Cria ticket com ticketConfig (departamento, categoria, prioridade)
    - Envia email de confirmação
```

