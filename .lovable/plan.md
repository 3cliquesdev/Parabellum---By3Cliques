

# Auditoria Final V5: Resíduos de Metadata Stale — Motor IA + Ecossistema

Após varrer o `ai-autopilot-chat` (10.281 linhas) e os webhooks (`handle-whatsapp-event`, `meta-whatsapp-webhook`, `auto-close-conversations`), identifiquei **6 problemas residuais** onde metadata stale pode sobrescrever updates incrementais.

---

## Resíduo 1: OTP Success no bloco PRIORIDADE ABSOLUTA usa `conversationMetadata` stale (CRÍTICO)

**Linha 2174-2185** (`ai-autopilot-chat`): O **primeiro** bloco de validação OTP (prioridade absoluta, antes de qualquer outro processamento) usa `conversationMetadata` (lido na L2021) para limpar flags:
```typescript
customer_metadata: {
  ...conversationMetadata,  // ← STALE (lido na L2021)
  awaiting_otp: false,
  otp_expires_at: null,
  last_otp_verified_at: new Date().toISOString()
}
```
**Nota:** O segundo bloco OTP (L6232) já foi corrigido na V4 com refetch. Este é o **primeiro** bloco, que ficou de fora.

**Correção:** Refetch metadata fresco antes de limpar flags OTP.

---

## Resíduo 2: `closeMeta` stale no bloco de confirmação de encerramento (MODERADO)

**Linhas 2240-2388** (`ai-autopilot-chat`): O bloco `awaiting_close_confirmation` lê `closeMeta = conversation.customer_metadata || {}` (stale do início da request) e usa em **5 updates** diferentes (L2279, L2296, L2322, L2372, L2388). Se greeting flags ou counters foram atualizados durante o pipeline, são sobrescritos.

**Correção:** Refetch metadata fresco no início do bloco de close confirmation.

---

## Resíduo 3: `customerMetadata` stale na limpeza de `awaiting_email_for_handoff` (MODERADO)

**Linha 2553** (`ai-autopilot-chat`): Após verificar o email do lead, o cleanup usa `{ ...customerMetadata }` (lido na L2412, início da request):
```typescript
const updatedMetadata = { ...customerMetadata };  // ← STALE
delete updatedMetadata.awaiting_email_for_handoff;
```
Este `updatedMetadata` é usado em múltiplos updates subsequentes (L2607, L2619, L2728, L2800), podendo sobrescrever greeting flags ou counters.

**Correção:** Refetch metadata fresco antes da limpeza.

---

## Resíduo 4: Greeting flag salva com `customerMetadata` stale (MODERADO)

**Linha 7326** (`ai-autopilot-chat`): A flag de saudação proativa usa `customerMetadata` (lido na L2412):
```typescript
const updatedMeta = { ...(customerMetadata as any || {}), [greetingFlagKey]: true };
```
Se o pipeline OTP ou close-confirmation atualizou o metadata antes deste ponto, as flags são sobrescritas.

**Correção:** Refetch metadata fresco antes de salvar greeting flag.

---

## Resíduo 5: Handoff de lead sem email usa `conversation.customer_metadata` stale (MENOR)

**Linha 5576** (`ai-autopilot-chat`): Ao salvar `awaiting_email_for_handoff`, usa `conversation.customer_metadata` (stale do início):
```typescript
customer_metadata: {
  ...(conversation.customer_metadata || {}),  // ← STALE
  awaiting_email_for_handoff: true,
  ...
}
```
**Correção:** Refetch metadata fresco.

---

## Resíduo 6: `handle-whatsapp-event` — `metadata` stale em updates OTP (MODERADO)

**Linhas 903, 1721, 1763** (`handle-whatsapp-event`): A variável `metadata` é lida uma vez na L663 e reutilizada em todos os updates OTP subsequentes:
```typescript
const metadata = conversation?.customer_metadata || {};  // L663 — lido UMA VEZ
// ... depois usado em:
customer_metadata: { ...metadata, awaiting_otp: true, ... }     // L903
customer_metadata: { ...metadata, otp_blocked: true, ... }      // L1721
customer_metadata: { ...metadata, otp_attempts: newAttempts }    // L1763
```
Se qualquer update intermediário modificou o metadata, os subsequentes sobrescrevem.

**Correção:** Refetch metadata fresco antes de cada update OTP no `handle-whatsapp-event`.

---

## Plano de Correções

| # | Prioridade | Arquivo | Correção |
|---|---|---|---|
| A | CRÍTICO | `ai-autopilot-chat` | Refetch metadata no 1º bloco OTP (L2174) |
| B | MODERADO | `ai-autopilot-chat` | Refetch metadata no bloco close confirmation (L2240) |
| C | MODERADO | `ai-autopilot-chat` | Refetch metadata na limpeza de awaiting_email (L2553) |
| D | MODERADO | `ai-autopilot-chat` | Refetch metadata antes de salvar greeting flag (L7326) |
| E | MENOR | `ai-autopilot-chat` | Refetch metadata no handoff lead sem email (L5576) |
| F | MODERADO | `handle-whatsapp-event` | Refetch metadata antes de cada update OTP (L903, L1721, L1763) |
| G | — | — | Redeploy `ai-autopilot-chat` e `handle-whatsapp-event` |

