

# Auditoria V7: Varredura Final — Motor IA + Ecossistema Completo

Após varrer `ai-autopilot-chat` (10.383 linhas), `handle-whatsapp-event` (2.209 linhas), `meta-whatsapp-webhook`, `auto-close-conversations`, `close-conversation` e `process-chat-flow`, identifiquei **1 único resíduo de ESCRITA com metadata stale** restante.

---

## Resíduo Único: Anti-loop counter reset usa `existingMetadata` stale (MODERADO)

**L9111-9148** (`ai-autopilot-chat`): O bloco anti-loop lê `existingMetadata` de `conversation.customer_metadata` (stale, do início da request) na L9111. Quando o contador atinge 2, o reset na L9146 usa essa variável stale em um WRITE:

```typescript
// L9111 — STALE (lido do objeto conversation original)
const existingMetadata = conversation.customer_metadata || {};

// L9146 — WRITE com spread stale
await supabaseClient.from('conversations').update({
  customer_metadata: { ...existingMetadata, ai_node_fallback_count: 0 }
}).eq('id', conversationId);
```

**Nota:** O bloco logo abaixo (L9165-9188) já foi corrigido na V4 com refetch fresco. Mas este bloco de reset (L9146) ficou de fora.

**Impacto:** Se greeting flags, OTP flags ou counters foram atualizados durante o pipeline antes de chegar a este ponto, o reset sobrescreve todas essas atualizações.

---

## Validação Completa — Todos os outros pontos estão OK

| Arquivo | Padrão | Status |
|---|---|---|
| `ai-autopilot-chat` L2249-2254 | Close confirmation — refetch V5 | OK |
| `ai-autopilot-chat` L5637-5642 | Handoff lead sem email — refetch V5 | OK |
| `ai-autopilot-chat` L3668-3673 | Email rebind — refetch V6 | OK |
| `ai-autopilot-chat` L3708-3713 | Email verify — refetch V6 | OK |
| `ai-autopilot-chat` L3742-3747 | Consultant redirect — refetch V6 | OK |
| `ai-autopilot-chat` L3831-3836 | Alt email — refetch V6 | OK |
| `ai-autopilot-chat` L3860-3865 | Lead route — refetch V6 | OK |
| `ai-autopilot-chat` L7399-7405 | Greeting flag — refetch V5 | OK |
| `ai-autopilot-chat` L9165-9188 | Fallback counter update — refetch V4 | OK |
| `handle-whatsapp-event` L789-791 | OTP resend — refetch V6 | OK |
| `handle-whatsapp-event` L911-913 | OTP start — refetch V5 | OK |
| `handle-whatsapp-event` L1737-1739 | OTP block — refetch V5 | OK |
| `handle-whatsapp-event` L1786-1788 | OTP attempts — refetch V5 | OK |
| `handle-whatsapp-event` L1679-1681 | Claim reset — clears to `{}` | OK (intencional) |
| `auto-close-conversations` L668 | Cron job — read+write sequencial | OK (sem concorrência) |
| `meta-whatsapp-webhook` | Apenas READs | OK |
| `process-chat-flow` | Sem `customer_metadata` | OK |

---

## Sobre READs com dados stale (decisão consciente)

Os seguintes pontos **leem** `conversation.customer_metadata` para branching (decisões condicionais), o que é aceitável porque:
- O valor stale é "bom o suficiente" para decidir qual branch seguir
- Nenhum desses READs resulta em um spread/merge para WRITE

Pontos de READ confirmados OK: L2021-2025, L2426-2428, L3628-3630, L3825, L5553-5555, L6190-6193, L6597-6598, L7356, L7772-7773, L8680-8681, L9111-9113.

---

## Plano de Correção

| # | Prioridade | Correção |
|---|---|---|
| A | MODERADO | Refetch metadata antes do reset do anti-loop counter (L9146) |
| B | — | Redeploy `ai-autopilot-chat` |

**Total: 1 write corrigido. Esta é a última correção necessária para atingir 100% de consistência de metadata.**

