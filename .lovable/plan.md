

# Auditoria Final IA — Estado Atual e Correções Pendentes

## Estado Geral

Nas rodadas anteriores, corrigimos com sucesso:
- Retry logic (linha 7148) — **OK**
- Fallbacks vazios (linhas 7210-7216) — **OK**
- Arrays de constantes e regex: `HALLUCINATION_INDICATORS`, `CONFLICT_INDICATORS`, `EXPLICIT_HUMAN_REQUEST_PATTERNS`, `FINANCIAL_ACTION_PATTERNS`, `WITHDRAWAL_ACTION_PATTERNS`, `REFUND_ACTION_PATTERNS`, `CANCELLATION_ACTION_PATTERNS`, `INFORMATIONAL_PATTERNS` — **OK**
- Helpers: `formatOptionsAsText`, `detectIntentCategory`, `getIntentCategoryLabel`, `maskEmail`, `maskPhone` — **OK**
- `validateResponseRestrictions` regex — **OK** (linhas 1374-1375 com UTF-8 correto)
- `generateRestrictedPrompt` (linhas 1228-1340) — **OK**
- `contextualizedSystemPrompt` handoff rules (linhas 6604-6670) — **OK**
- OTP de saque direto (linhas 6282-6288) — **OK**
- Cancelamento Kiwify bypass (linhas 5813-5821) — **OK**
- `createTicketSuccessMessage` (linhas 1163-1184) — **OK**
- `notFoundPatterns` Strict RAG (linhas 4233-4237) — **OK**
- Auto-exit terms (linhas 7170-7172) — **OK**
- Tool handler messages (verify_email, resend_otp, send_financial_otp, verify_otp, check_order_status, check_tracking, close_conversation, request_human_agent) — **OK**

## Problemas Restantes

### 1. ALTO — Cenário B/C do System Prompt (linhas 6710-6879)
O "Cérebro Financeiro" seções B e C ainda têm mojibake extenso. Embora a IA consiga interpretar parcialmente, as instruções contêm:
- `CENÃRIO B` → `CENÁRIO B` (linha 6710)
- `CONFIRMAÃ‡ÃƒO OBRIGATÃ"RIA` → `CONFIRMAÇÃO OBRIGATÓRIA` (linha 6729)
- `RESOLUÃ‡ÃƒO` → `RESOLUÇÃO` (linha 6782)
- `EVIDÃŠNCIAS` → `EVIDÊNCIAS` (linha 6802)
- `NÃºmero` → `Número`, `cÃ³digo` → `código`, `descriÃ§Ã£o` → `descrição` em várias linhas
- `REGRAS CRÃTICAS GERAIS` → `REGRAS CRÍTICAS GERAIS` (linha 6839)
- Instruções de ferramentas (linhas 6850-6858) com mojibake em todas as descrições
- Contexto do cliente (linhas 6863-6879) com mojibake

**Impacto**: Desperdiça tokens, pode confundir a IA em instruções críticas de fluxo financeiro.

### 2. ALTO — Guard financeiro no system prompt (linhas 6536-6540)
Strings de instrução com mojibake: `AÃ‡ÃƒO`, `solicitaÃ§Ã£o`, `responsÃ¡vel`, `monetÃ¡rios`.

### 3. MÉDIO — `financialIssueTypes` array (linha 7760)
Contém `'devoluÃ§Ã£o'` e `'cobranÃ§a'` com mojibake — estes nunca casarão com input UTF-8 correto do `args.issue_type`. A IA pode enviar "devolução" como issue_type e o guard não bloqueará.

### 4. MÉDIO — Keywords array com mojibake (linha 761)
`'devoluÃ§Ã£o'` num array de keywords — nunca fará match com input UTF-8.

### 5. BAIXO — ESCAPE_PATTERNS regex (linhas 1397, 1405-1406)
`sÃ³ um instante` → nunca casa com "só um instante" no output da IA.

### 6. COSMÉTICO — ~3900 ocorrências em logs/comentários
Não afetam funcionalidade mas dificultam debugging.

---

## Plano de Correção (2 blocos)

### Bloco 1: Cenário B/C + Instruções de ferramentas no system prompt (linhas 6536-6879)
Reescrever todas as strings do "Cérebro Financeiro" seções B e C, instruções de ferramentas e contexto do cliente com UTF-8 correto.

### Bloco 2: Arrays funcionais e ESCAPE_PATTERNS
- Corrigir `financialIssueTypes` (linha 7760): `'devoluÃ§Ã£o'` → `'devolução'`, `'cobranÃ§a'` → `'cobrança'`
- Corrigir keywords array (linha 761): `'devoluÃ§Ã£o'` → `'devolução'`  
- Corrigir ESCAPE_PATTERNS (linhas 1397, 1405-1406): restaurar regex com UTF-8 correto

---

## Resultado
Após estes 2 blocos, todas as strings funcionais (regex, arrays, prompts, mensagens ao cliente, instruções à IA) estarão 100% UTF-8. Restam apenas logs/comentários cosméticos.

