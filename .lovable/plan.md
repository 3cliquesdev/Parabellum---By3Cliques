

# Auditoria Final: Resíduos de Lógica que Ainda Podem Causar Erros

Após varrer o arquivo completo (~10.211 linhas) com foco nas correções já aplicadas, encontrei **5 problemas residuais** que podem causar regressões.

---

## Resíduo 1: `getWhatsAppInstanceForConversation` com assinatura ERRADA em 2 locais (CRÍTICO)

A função aceita 4 parâmetros: `(supabaseClient, conversationId, whatsappInstanceId, conversationData?)`.

**Linha 6162** (OTP inválido) — O "fix do Resíduo 3" anterior mudou para 3 params, passando `conversation` (objeto) como 3º argumento no lugar de `conversation.whatsapp_instance_id` (string):
```typescript
// ERRADO (3 params — conversation como whatsappInstanceId)
getWhatsAppInstanceForConversation(supabaseClient, conversationId, conversation)
```

**Linha 7323** (saudação proativa) — Mesmo problema:
```typescript
// ERRADO
getWhatsAppInstanceForConversation(supabaseClient, conversationId, conversation)
```

**Todas as OUTRAS chamadas** (linhas 5943, 6259, etc.) usam a assinatura correta de 4 params.

**Resultado:** WhatsApp não envia "código inválido" nem saudação proativa. A mensagem é salva no banco mas o cliente nunca recebe.

**Correção:** Restaurar para 4 params em ambos os locais:
```typescript
getWhatsAppInstanceForConversation(supabaseClient, conversationId, conversation.whatsapp_instance_id, conversation)
```

---

## Resíduo 2: Restriction Violation NÃO incrementa counter anti-loop (MODERADO)

O bloco de **restriction violation** (linha 9463-9515) substitui `assistantMessage` pelo `fallbackMessage` mas **NÃO seta `isFallbackResponse = true`** e **NÃO incrementa o counter**. 

O counter update (linha 9035) depende de `isFallbackResponse` ser true. Como a restriction violation acontece **DEPOIS** do counter update (linha 9025-9048), o counter nunca conta restriction violations.

**Resultado:** Se a IA violar restrições repetidamente no mesmo nó, o anti-loop de 2 tentativas nunca dispara. O cliente fica em loop recebendo o fallbackMessage do nó indefinidamente.

**Correção:** No bloco de restriction violation (após linha 9501), fazer update direto do counter no metadata (mesmo padrão do contract_violation fix na linha 9437-9453).

---

## Resíduo 3: `isFinancialRequest` redeclarada no handoff (MENOR)

Na linha 5864, `isFinancialRequest` é declarada com `const`. Na linha 9280 (dentro do handoff sem flow_context), é **redeclarada com `let`**:
```typescript
let isFinancialRequest = FINANCIAL_ACTION_PATTERNS.some(...)
```

Isso usa `FINANCIAL_ACTION_PATTERNS` (patterns de AÇÃO como saque/reembolso) em vez de `FINANCIAL_BARRIER_KEYWORDS` (keywords genéricas como "saldo", "pix"). O resultado é que tickets financeiros automáticos no handoff só são criados para ações (saque, reembolso) mas não para reclamações genéricas ("cadê meu pix"), que era a intenção original.

**Correção:** Renomear a variável na linha 9280 para `isFinancialHandoffRequest` para evitar shadow e manter ambas as detecções.

---

## Resíduo 4: Metadata stale no handoff sobrescreve greeting flags (MODERADO)

Na linha 9212-9218, o handoff sem flow_context faz:
```typescript
customer_metadata: {
  ...(conversation.customer_metadata || {}),
  ...( isLeadWithoutEmail && { ... })
}
```

O `conversation.customer_metadata` foi lido no **início da request**. Se a saudação proativa salvou `greeting_sent_node_X: true` no meio do request, esse update sobrescreve com o metadata antigo (sem a flag).

**Correção:** Usar `freshConv?.customer_metadata` (refetch) ou `jsonb_set` incremental, como já feito no counter update (linha 9026-9031).

---

## Resíduo 5: Cache de respostas com fallbackMessage do nó (MENOR)

Na linha 9865-9886, o cache skip verifica apenas `FALLBACK_PHRASES`. Mas quando a restriction violation substitui `assistantMessage` pelo `fallbackMessage` do nó (ex: "Pode me contar mais sobre o que precisa?"), essa frase **não está** em `FALLBACK_PHRASES`. O cache salva a resposta genérica do nó como se fosse uma resposta válida.

**Resultado:** Futuras perguntas com hash similar retornam o fallbackMessage cacheado em vez de chamar a LLM.

**Correção:** Adicionar check: se `isFallbackResponse === true` (já setado corretamente após os fixes), skip cache. Usar a flag em vez de re-checar as phrases:
```typescript
const shouldSkipCache = isFallbackResponse || FALLBACK_PHRASES.some(...)
```

---

## Plano de Correções

| # | Prioridade | Correção |
|---|---|---|
| A | CRÍTICO | Restaurar assinatura de 4 params em linhas 6162 e 7323 |
| B | MODERADO | Adicionar counter direto no bloco de restriction violation (L9501) |
| C | MENOR | Renomear `isFinancialRequest` redeclarada no handoff (L9280) |
| D | MODERADO | Refetch metadata no handoff (L9212) |
| E | MENOR | Usar `isFallbackResponse` no cache skip (L9865) |
| F | — | Redeploy `ai-autopilot-chat` |

