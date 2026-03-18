

# Auditoria: Lógica Antiga Residual que Ainda Pode Causar Erros

## Análise da Ordem de Execução Atual

A sequência no `ai-autopilot-chat/index.ts` é:

```text
1. OTP Guard (L6100) — Valida OTP ou "código inválido"
2. Saudação Proativa (L7262) — Greeting por nó
3. LLM Call (L7368) — Chama IA
4. Fallback de resposta vazia (L7400-7465) — Gera mensagem se LLM vazio
5. Tool Calls (L7478) — Executa tools (verify_email, etc.)
6. FALLBACK DETECTOR (L8948) — Detecta frases de fallback
7. ANTI-LOOP CHECK (L8963) — Verifica ai_node_fallback_count >= 2
8. ATUALIZA CONTADOR (L9018) — Incrementa fallback_count
9. FALLBACK HANDLER (L9040) — Se fallback, limpa frases ou handoff
10. CONTRACT VIOLATION (L9357) — Detecta escape, seta isFallbackResponse=true
11. RESTRICTION CHECK (L9424) — forbidQuestions, forbidFinancial
12. PERSISTE + ENVIA (L9531) — Salva mensagem e envia WhatsApp
```

---

## Resíduo 1: RACE CONDITION no Anti-loop (CRÍTICO)

**Problema:** O anti-loop (passo 7, L8963) verifica `ai_node_fallback_count >= 2` ANTES do contract_violation (passo 10, L9419) setar `isFallbackResponse = true`. Isso significa:

- Na 1ª violation: `isFallbackResponse` é false no passo 6 → counter NÃO incrementa no passo 8 → violation seta true no passo 10 → MAS o update do passo 8 já rodou com count=0
- Na 2ª violation: mesma coisa — o counter nunca chega a 2 porque o `isFallbackResponse=true` do contract_violation acontece DEPOIS do update

**Resultado:** O anti-loop de 2 fallbacks **nunca dispara para contract_violations**. O loop de saudação (BUG 2) continua indefinidamente.

**Correção:** Mover o bloco de contract_violation (L9357-9421) para ANTES do fallback detector (L8948). Ou: no contract_violation, fazer o update do counter diretamente em vez de depender do pipeline posterior.

---

## Resíduo 2: `isFallbackResponse = false` no fallback handler (L9159) zera o counter

**Problema:** Na linha 9159, dentro do `if (flow_context)` do fallback handler, após limpar frases de fallback, o código faz `isFallbackResponse = false`. Porém o counter JÁ foi incrementado no passo 8 (L9024). Na próxima iteração, o counter foi incrementado mas depois "desfeito" conceitualmente — o fallback foi "resolvido" pela limpeza.

**Mas:** A limpeza na L9135 substitui a mensagem por "Entendi! Poderia me dar mais detalhes..." quando o texto limpo fica < 5 chars. Isso é **exatamente a mesma mensagem** do contract_violation (L9418). O cliente recebe a mesma frase genérica repetidamente, mas o counter foi resetado porque `isFallbackResponse = false`.

**Correção:** NÃO resetar `isFallbackResponse` quando a mensagem limpa fica < 5 chars (L9135-9136), pois isso indica que a IA realmente não conseguiu responder.

---

## Resíduo 3: Greeting flag sobrescrita pelo counter update (MODERADO)

**Problema:** Na L7314, a saudação salva `{ ...customerMetadata, [greetingFlagKey]: true }` no metadata. Mas na L9028, o counter update faz `{ ...existingMetadata, ai_node_current_id: ..., ai_node_fallback_count: ... }` onde `existingMetadata` vem de `conversation.customer_metadata` — que foi lido NO INÍCIO da request (L9020), ANTES da saudação salvar a flag.

**Resultado:** O update do counter SOBRESCREVE a flag de saudação com o metadata antigo (sem a flag). Na próxima mensagem, `alreadySentGreeting` será false e a saudação disparará novamente.

**Correção:** Refetch o metadata da conversa antes do update do counter, ou fazer merge incremental com `jsonb_set` em vez de sobrescrever todo o objeto.

---

## Resíduo 4: Email search case-sensitive (MODERADO)

**Problema:** Na L7500, `.eq('email', emailInformado)` faz busca case-sensitive no Postgres. Se o email está salvo como "User@Gmail.com" e o cliente digita "user@gmail.com", não encontra.

**Correção:** Usar `.ilike('email', emailInformado)` ou normalizar com `.eq('email', emailInformado.toLowerCase())` + garantir que emails são salvos em lowercase.

---

## Resíduo 5: Fallback `isFinancialRequest` sobrepõe `isFinancialActionRequest` (MENOR)

**Problema:** Na L7442-7446, quando a LLM retorna vazio:
- `isFinancialActionRequest` → pede email (correto)
- `isFinancialRequest` → resposta contextualizada (correto)

Mas a variável `isFinancialActionRequest` inclui `isWithdrawalRequest || isRefundRequest`. Se o pattern de saque expandido matcheia (ex: "meu saque pendente"), o sistema pede email mesmo quando o cliente pode já ter email cadastrado no contato. Deveria verificar `contactHasEmail` antes de pedir email.

**Correção:** Antes de pedir email em L7443, verificar se `contactHasEmail` é true — se sim, ir direto para OTP em vez de pedir email novamente.

---

## Plano de Correções (Prioridade)

### A. Fix Race Condition do Anti-loop (Resíduo 1) — CRÍTICO
- No bloco de contract_violation (L9417-9419), além de setar `isFallbackResponse = true`, fazer UPDATE DIRETO do `ai_node_fallback_count` no metadata (incrementar +1)
- Isso garante que o counter é atualizado mesmo com a ordem de execução atual

### B. Não resetar fallback quando mensagem fica vazia (Resíduo 2)
- Na L9135, quando `cleanedMessage.length < 5`: manter `isFallbackResponse = true` (remover L9159 nesse caso)

### C. Refetch metadata antes do counter update (Resíduo 3)
- Na L9020, em vez de usar `conversation.customer_metadata`, fazer um `select` fresh do metadata da conversa para não sobrescrever a greeting flag

### D. Email case-insensitive (Resíduo 4)
- Na L7500, trocar `.eq('email', emailInformado)` por `.ilike('email', emailInformado)`

### E. Verificar email antes de pedir (Resíduo 5)
- Na L7442-7443, se `contactHasEmail`, não pedir email — ir direto para fluxo OTP

### F. Deploy
- Redeploiar `ai-autopilot-chat` com todas as correções

