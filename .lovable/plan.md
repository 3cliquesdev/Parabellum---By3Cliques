

# Auditoria V15: Conversa #118D3A33 — Bugs Críticos

## Timeline da Conversa

| Hora | Quem | Mensagem | Problema |
|---|---|---|---|
| 13:34:48 | Cliente | "oi" | Menu OK |
| 13:34:57 | Cliente | "1" (Nacional) | Menu assunto OK |
| 13:35:03 | Cliente | "2" (Financeiro) | — |
| 13:35:09 | IA | "Não encontrei informações..." | **BUG 27** — Fallback na saudação |
| 13:41:19 | Cliente | "2" (re-selecionou) | — |
| 13:42:09 | IA | "Olá! Sou Helper Financeiro..." | Saudação OK (segunda tentativa) |
| 13:49:15 | Cliente | "Quero fazer um cancelamento" | — |
| 13:50:43 | IA | "Não encontrei informações..." | **BUG 28** — Cancelamento não roteado |
| 13:58:36 | Cliente | "Quero cancelar é simples..." | — |
| 13:59:14 | IA | Resposta Kiwify cancelamento | ✅ Bypass OK |
| 14:08:57 | Cliente | "Quero sacar!" | — |
| 14:10:24 | IA | "Identificamos seu cadastro. Vou enviar código..." | **BUG 29** — OTP alucinado pela LLM |

---

## BUG 27 (MODERADO): Primeira Saudação Falhou — Fallback em Vez de Greeting

**O que aconteceu:** Cliente selecionou "2" (Financeiro) → IA respondeu com fallback "Não encontrei informações" em vez da saudação proativa "Olá! Sou Helper Financeiro".

**Causa provável:** A primeira invocação do `ai-autopilot-chat` com `skipInitialMessage` não funcionou. Na segunda tentativa (6 min depois), o greeting funcionou. Isso pode ser uma race condition no webhook — o `skipInitialMessage` pode não ter sido propagado corretamente na primeira chamada, fazendo o "2" ser enviado como mensagem real ao LLM, que não encontrou artigos relevantes.

**Evidência:** Não há `ai_event` registrado às 13:35 — o evento `zero_confidence_cautious` mais antigo é de 13:42:09 (corresponde à segunda seleção "2"). Isso sugere que o primeiro "2" pode ter sido processado por um caminho diferente (webhooks direto sem buffer, ou o buffer não ativou `skipInitialMessage`).

**Status:** Difícil de reproduzir sem logs — pode ser intermitente. Investigar se o webhook Meta processa a primeira transição para AI node sem a flag `skipInitialMessage`.

---

## BUG 28 (CRITICO): "Quero fazer um cancelamento" no Nó Financeiro → Fallback

**O que aconteceu:** Cliente no `node_ia_financeiro` disse "Quero fazer um cancelamento" → IA respondeu com fallback genérico.

**Causa raiz (confirmada):** O nó `node_ia_financeiro` no fluxo V5 Enterprise **NÃO tem** edge `cancelamento`. As edges existentes são:
- `default` → `node_escape_financeiro`
- (nenhuma outra)

O edge `cancelamento` existe apenas no nó `node_ia_duvidas` (→ `node_ia_cancelamento`).

Além disso, `forbid_cancellation` está **NULL** no nó financeiro. Sem esta flag, a IA não injeta a regra `[REGRA CANCELAMENTO]` no prompt, então não emite `[[FLOW_EXIT:cancelamento]]`. Resultado: a IA tenta responder sobre cancelamento sem artigos na KB → zero_confidence → fallback.

**Fix necessário no fluxo visual:**
1. Adicionar edge `cancelamento` de `node_ia_financeiro` → `node_ia_cancelamento` (ou `node_ticket_cancelamento`)
2. Setar `forbid_cancellation: true` no nó `node_ia_financeiro`

**Alternativa no código:** Se o nó financeiro não tem edge `cancelamento`, o `process-chat-flow` deveria detectar `[[FLOW_EXIT:cancelamento]]` e buscar o edge em nós vizinhos ou fazer cross-routing.

---

## BUG 29 (CRITICO): OTP Alucinado pela LLM — Não Executou OTP Real

**O que aconteceu:** Cliente disse "Quero sacar!" → IA respondeu "Identificamos seu cadastro. Vou enviar um código de verificação..." — mas este OTP foi **inventado pela LLM**, não executado pelo código.

**Evidência:**
- A resposta NÃO corresponde ao template hardcoded do OTP (L6473-6479: "**Verificação de Segurança**\n\nOlá ${contactName}!...")
- O `ai_event` mostra `confidence_score: 0, articles_count: 0` — zero_confidence_cautious
- O `customer_metadata` mostra `awaiting_otp: false` (não foi marcado pelo código)
- O guard em L6421 tem `!flow_context` — como o fluxo está ativo (`chat_flow_states.status = active`), o bloco OTP inteiro foi **pulado**

**Causa raiz:** O guard `!flow_context` (L6421) foi adicionado para respeitar a soberania do fluxo visual. O raciocínio era que o fluxo teria seu próprio ramo de OTP via `verify_customer_otp` node. Mas o fluxo V5 Enterprise **NÃO tem** um nó OTP nem edge `saque` no `node_ia_financeiro`. Então:
1. Código OTP foi pulado (flow_context ativo)
2. IA caiu no LLM com zero artigos
3. LLM **alucinação**: inventou uma resposta de OTP sem executar o envio real
4. Cliente nunca recebeu código real no email

**Fix necessário:**
- **Opção A (fluxo):** Adicionar edge `saque` no `node_ia_financeiro` → nó `verify_customer_otp` → nó de ticket de saque
- **Opção B (código):** Remover o guard `!flow_context` em L6421 para que o OTP seja ativado dentro de fluxos quando ação financeira é detectada. O OTP do código já é funcional e envia o email real.
- **Opção C (híbrido):** Manter `!flow_context` mas adicionar uma flag `has_otp_node` no flow_context. Se o fluxo NÃO tem nó OTP, o código assume o OTP.

---

## BUG 30 (MODERADO): Nó Financeiro Sem Rotas de Escape para Intenções Cruzadas

O `node_ia_financeiro` tem apenas 1 edge (`default` → escape). Faltam edges para:
- `cancelamento` → nó de cancelamento
- `saque` → nó de saque/OTP
- `comercial` → nó comercial (se cliente quiser trocar de assunto)

Sem estas rotas, qualquer intenção diferente de "financeiro genérico" gera fallback ou fica presa no nó.

---

## Plano de Correção

### 1. Bug 28+30 — Adicionar edges faltantes no fluxo (via migration)

Atualizar o `flow_definition` do fluxo `cafe2831` para adicionar:
- Edge `cancelamento`: `node_ia_financeiro` → `node_ia_cancelamento`
- Edge `saque`: `node_ia_financeiro` → nó de saque (criar se não existir)
- Setar `forbid_cancellation: true` e `forbid_withdrawal: true` no `node_ia_financeiro`

### 2. Bug 29 — OTP dentro de fluxos ativos

Remover o guard `!flow_context` em L6421 do `ai-autopilot-chat`. Se o cliente está num nó de IA e pede saque, o OTP deve ser ativado independente do fluxo. O flow_context continuará ativo — o OTP é uma camada de segurança transversal.

Adicionar check para evitar que a LLM alucine OTP: se `isFinancialActionRequest` e `flow_context` ativo mas OTP não enviado, forçar o OTP do código ao invés de deixar para o LLM.

### 3. Bug 27 — Telemetria para skipInitialMessage

Adicionar log explícito no webhook para confirmar quando `skipInitialMessage` é propagado na primeira transição menu → AI node. Isso ajudará a diagnosticar se é race condition ou bug no path.

### 4. Proteção anti-alucinação OTP

Adicionar ao prompt do sistema uma regra explícita:
```
NUNCA diga que vai enviar código de verificação, OTP ou código de segurança.
Se o cliente pedir saque/reembolso, NÃO prometa envio de código — o sistema faz isso automaticamente.
```

### Resumo de Arquivos

1. **`supabase/functions/ai-autopilot-chat/index.ts`** — Remover guard `!flow_context` no OTP (L6421), adicionar regra anti-alucinação OTP no prompt
2. **Migration SQL** — Atualizar `flow_definition` do fluxo `cafe2831` com edges + flags faltantes
3. **Telemetria** — Logs adicionais no webhook para skipInitialMessage

