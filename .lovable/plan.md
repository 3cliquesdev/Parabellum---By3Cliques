

# Auditoria V6: Resíduos de Metadata Stale Remanescentes

Após varrer `ai-autopilot-chat` (10.324 linhas) e `handle-whatsapp-event` (2.202 linhas), identifiquei **7 pontos** onde `conversation.customer_metadata` (stale, lido no início da request) ainda é usado em operações de ESCRITA.

---

## Resíduo 1: `resend_otp` tool — metadata stale (MODERADO)

**L7678** (`ai-autopilot-chat`): A tool `resend_otp` usa `conversation.customer_metadata || {}` para salvar `awaiting_otp`:
```typescript
const currentMetadata = conversation.customer_metadata || {};  // ← STALE
await supabaseClient.from('conversations').update({
  customer_metadata: { ...currentMetadata, awaiting_otp: true, ... }
})
```
Se greeting flags ou counters foram atualizados durante o pipeline, são sobrescritos.

---

## Resíduo 2: `send_financial_otp` tool — metadata stale (MODERADO)

**L7752** (`ai-autopilot-chat`): Mesmo padrão na tool `send_financial_otp`:
```typescript
const currentMetadata = conversation.customer_metadata || {};  // ← STALE
```

---

## Resíduo 3: `close_conversation` tool — metadata stale (MODERADO)

**L8823** (`ai-autopilot-chat`): A tool `close_conversation` usa `conversation.customer_metadata || {}` para salvar `awaiting_close_confirmation`:
```typescript
const currentMeta = conversation.customer_metadata || {};  // ← STALE
```

---

## Resíduo 4: Email verificado — 4 updates com metadata stale (MODERADO)

**L3668, L3701, L3732, L3812, L3836** (`ai-autopilot-chat`): No bloco de verificação de email (triagem), TODOS os updates usam `conversation.customer_metadata || {}` diretamente:
```typescript
...(conversation.customer_metadata || {}),  // ← STALE em 5 locais
```

---

## Resíduo 5: After-hours handoff — metadata stale (MENOR)

**L8773** (`ai-autopilot-chat`): O handoff fora do horário usa `conversation.customer_metadata || {}`:
```typescript
const existingMeta = conversation.customer_metadata || {};  // ← STALE
```

---

## Resíduo 6: `handle-whatsapp-event` OTP resend — `currentMetadata` stale (MODERADO)

**L788** (`handle-whatsapp-event`): O reenvio de OTP após 10 min usa `currentMetadata` (variável local derivada do metadata original na L663/746):
```typescript
customer_metadata: {
  ...currentMetadata,  // ← pode estar stale se L751 atualizou parcialmente
  awaiting_otp: true, ...
}
```
Nota: `currentMetadata` é reatribuída na L764 após limpeza, mas essa limpeza em si usa o metadata da L663, criando uma cadeia de stale parcial.

---

## Resíduo 7: `customerMetadata` read para lógica — OK, mas write stale (MENOR)

**L2607-2608**: `customerMetadata.original_intent` é lido para lógica (OK para reads), mas `updatedMetadata` na L2617 é derivado de `{ ...customerMetadata }` que foi refetchado na V5 (L2570). Este ponto já foi corrigido — confirmado OK.

---

## Plano de Correções

| # | Prioridade | Arquivo | Linha | Correção |
|---|---|---|---|---|
| A | MODERADO | `ai-autopilot-chat` | L7678 | Refetch metadata na tool `resend_otp` |
| B | MODERADO | `ai-autopilot-chat` | L7752 | Refetch metadata na tool `send_financial_otp` |
| C | MODERADO | `ai-autopilot-chat` | L8823 | Refetch metadata na tool `close_conversation` |
| D | MODERADO | `ai-autopilot-chat` | L3668,3701,3732,3812,3836 | Refetch metadata nos 5 updates de verificação de email |
| E | MENOR | `ai-autopilot-chat` | L8773 | Refetch metadata no after-hours handoff |
| F | MODERADO | `handle-whatsapp-event` | L788 | Refetch metadata no OTP resend após 10min |
| G | — | — | — | Redeploy ambas edge functions |

**Total: 11 writes corrigidos em 2 arquivos.**

