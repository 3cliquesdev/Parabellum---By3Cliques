

# Auditoria Final V3: Resíduos de Lógica que Ainda Podem Causar Erros

Após varrer as 10.239 linhas com foco nas correções já aplicadas, identifiquei **4 problemas residuais**.

---

## Resíduo 1: `last_transfer` cleanup usa metadata stale (MODERADO)

**Linha 9627**: Ao limpar o `last_transfer` após a IA receptora responder, o código usa `conversation.customer_metadata` (lido no início da request):
```typescript
const metaNow = (conversation.customer_metadata || {}) as Record<string, any>;
const { last_transfer: _removed, ...cleanedMeta } = metaNow;
await supabaseClient.from("conversations").update({ customer_metadata: cleanedMeta }).eq("id", conversationId);
```

Neste ponto do pipeline, o metadata já foi atualizado múltiplas vezes (greeting flag, counter update, restriction counter). Usar o objeto stale sobrescreve TODAS essas atualizações.

**Correção:** Refetch metadata fresco antes de limpar `last_transfer`.

---

## Resíduo 2: Transfer context salva com metadata stale (MODERADO)

**Linha 9115-9128**: No `[[FLOW_EXIT]]` intencional, o contexto de transferência é salvo com `conversation?.customer_metadata`:
```typescript
const currentMeta = (conversation?.customer_metadata || {});
// ...
customer_metadata: { ...currentMeta, last_transfer: transferContext }
```

Mesmo problema: usa o metadata do início da request, sobrescrevendo greeting flags e counter updates que foram salvos durante o pipeline.

**Correção:** Refetch metadata antes de salvar transfer context.

---

## Resíduo 3: Metadata stale no anti-spam block (MENOR)

**Linha 2487**: O update de `handoff_blocked_at` usa `customerMetadata` (variável do início da request):
```typescript
customer_metadata: {
  ...customerMetadata,
  handoff_blocked_at: new Date().toISOString()
}
```

Se este bloco executar após um greeting flag ou counter update, sobrescreve.

**Correção:** Refetch ou usar merge incremental.

---

## Resíduo 4: `pending_email_confirmation` no metadata sem TTL (MENOR)

**Linha 7519-7525**: Quando email não é encontrado, salva `pending_email_confirmation` e `pending_email_timestamp` no metadata. Não há cleanup — fica permanentemente no metadata mesmo após o email ser confirmado ou a conversa fechada.

**Correção:** Limpar esses campos após confirmação do email ou resolver da conversa. Não é urgente, mas causa metadata poluído.

---

## Plano de Correções

| # | Prioridade | Correção |
|---|---|---|
| A | MODERADO | Refetch metadata na limpeza de `last_transfer` (L9627) |
| B | MODERADO | Refetch metadata no save de transfer context (L9115) |
| C | MENOR | Refetch metadata no anti-spam block (L2487) |
| D | MENOR | Documentar cleanup de `pending_email_confirmation` (não urgente) |
| E | — | Redeploy `ai-autopilot-chat` |

