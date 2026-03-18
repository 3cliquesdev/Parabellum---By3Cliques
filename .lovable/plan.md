

# Auditoria Final V4: Resíduos de Metadata Stale em Tool Calls e OTP

Após varrer as 10.248 linhas com foco nos pontos que ainda usam `conversation.customer_metadata` (stale, lido no início da request) em vez de refetch fresco, encontrei **4 problemas residuais**.

---

## Resíduo 1: OTP Success limpa flags com metadata stale (MODERADO)

**Linha 6232-6243**: Quando OTP é validado com sucesso, o código limpa `awaiting_otp` usando `conversationMetadata` (lido na L6118, início da request):
```typescript
customer_metadata: {
  ...conversationMetadata,  // ← STALE do início da request
  awaiting_otp: false,
  otp_expires_at: null,
  last_otp_verified_at: new Date().toISOString()
}
```
Se qualquer outro processo atualizou o metadata entre o início da request e este ponto (ex: greeting flag), a limpeza sobrescreve essas atualizações.

**Correção:** Refetch metadata fresco antes de limpar flags OTP.

---

## Resíduo 2: Tool `verify_customer_email` — metadata stale em 2 locais (MODERADO)

**Linha 7518** (email não encontrado) e **Linha 7557** (email encontrado): Ambos usam `conversation.customer_metadata` para salvar `pending_email_confirmation` ou `email_verified_in_db`:
```typescript
const currentMetadata = conversation.customer_metadata || {};  // ← STALE
```
Greeting flags, counter updates, e OTP flags salvos durante o pipeline são sobrescritos.

**Correção:** Refetch metadata fresco em ambos os cenários do `verify_customer_email`.

---

## Resíduo 3: Tool `confirm_email_not_found` — metadata stale (MENOR)

**Linha 7734**: Usa `conversation.customer_metadata` para limpar `pending_email_confirmation`:
```typescript
const currentMetadata = conversation.customer_metadata || {};  // ← STALE
```
Mesma classe de bug. O update nas linhas 7741-7750 e 7792-7800 sobrescreve metadata recente.

**Correção:** Refetch metadata fresco antes de limpar pending email flags.

---

## Resíduo 4: `classify_and_resolve_ticket` — metadata stale na limpeza de flag (MENOR)

**Linha 8930-8935**: O código limpa `ai_can_classify_ticket` usando `convMeta` que pode ser stale se lido no início do bloco em vez de refetch fresco:
```typescript
const cleanMetaClassify = { ...convMeta };
delete cleanMetaClassify.ai_can_classify_ticket;
```
Se `convMeta` veio de um select recente (dentro do mesmo bloco try), pode estar ok. Mas precisa verificar a origem — se `convMeta` é do select da L8854 (dentro do tool call block), está relativamente fresco.

**Correção:** Confirmar que `convMeta` vem de select recente; se não, refetch.

---

## Plano de Correções

| # | Prioridade | Correção |
|---|---|---|
| A | MODERADO | Refetch metadata antes de limpar flags OTP (L6232) |
| B | MODERADO | Refetch metadata nos 2 cenários de `verify_customer_email` (L7518 e L7557) |
| C | MENOR | Refetch metadata em `confirm_email_not_found` (L7734) |
| D | MENOR | Verificar/corrigir `convMeta` em `classify_and_resolve_ticket` (L8930) |
| E | — | Redeploy `ai-autopilot-chat` |

