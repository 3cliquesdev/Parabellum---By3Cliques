

# Auditoria Completa: Lógica de Desambiguação Financeira

## Bugs Encontrados

### 🔴 BUG CRÍTICO 1: OTP é enviado mesmo quando o termo é ambíguo

**Arquivo:** `ai-autopilot-chat/index.ts`, linhas 5986-6120

Quando `flow_context.forbidFinancial=true` e o termo é **ambíguo** (ex: "Sacar!"), o guard na linha 6018 **não retorna** (correto), mas o código **continua para a linha 6030** que envia OTP direto para o cliente.

```text
Fluxo atual com "Sacar!" + forbidFinancial:
  L5986: if (isWithdrawalRequest) ← TRUE (OTP_REQUIRED_KEYWORDS inclui "sacar")
  L5989:   if (forbidFinancial) 
  L5995:     if (isWithdrawalActionClear) ← FALSE ("Sacar!" isolado)
  L6018:     else → log + NÃO retorna
  L6030: continua → ENVIA OTP! ❌ BUG
```

**Fix:** Após o bloco `else` (linha 6018-6027), deve haver um `return` ou um skip do bloco OTP inteiro. Quando forbidFinancial + ambíguo, precisa **sair do bloco `if` de OTP** completamente e deixar a IA desambiguar.

### 🔴 BUG CRÍTICO 2: `[[FLOW_EXIT:financeiro]]` não é reconhecido pelo parser

**Arquivo:** `ai-autopilot-chat/index.ts`, linha 8619

A IA é instruída a responder com `[[FLOW_EXIT:financeiro]]` quando o cliente confirma ação financeira após desambiguação. Porém:
- `ESCAPE_PATTERNS` usa `/\[\[FLOW_EXIT\]\]/i` → **NÃO** matcha `[[FLOW_EXIT:financeiro]]`
- `isCleanExit` usa `/^\s*\[\[FLOW_EXIT\]\]\s*$/` → **NÃO** matcha

Resultado: o token `[[FLOW_EXIT:financeiro]]` vai aparecer como texto literal na mensagem enviada ao cliente.

**Fix:** Atualizar as regras:
- `ESCAPE_PATTERNS`: `/\[\[FLOW_EXIT(:[a-z_]+)?\]\]/i`
- `isCleanExit`: `/^\s*\[\[FLOW_EXIT(:[a-z_]+)?\]\]\s*$/`
- Extrair o intent suffix (`:financeiro`) e incluir no response como `ai_exit_intent`

### 🟡 BUG 3: Confirmação pós-desambiguação ("sim") não é tratada

Quando a IA pergunta "Posso te ajudar com informações ou fazer uma solicitação?" e o cliente responde só "sim" ou "isso", não há mecanismo para detectar que isso é uma confirmação de ação financeira. O "sim" isolado:
- Não bate no `financialActionPattern` 
- Não bate no `financialAmbiguousPattern`
- A IA vai responder normalmente sem saber o contexto da pergunta anterior

**Fix:** Confiar na IA para tratar isso via prompt — a instrução já diz para responder com `[[FLOW_EXIT:financeiro]]` se confirmar ação. Mas isso depende do Bug 2 estar corrigido. Nenhuma mudança de regex necessária, apenas o Bug 2.

### 🟡 BUG 4: `isWithdrawalRequest` captura termos amplos demais

`OTP_REQUIRED_KEYWORDS` inclui `'saque'` e `'sacar'` como match simples via `includes()`. Qualquer mensagem com essas palavras ativa `isWithdrawalRequest=true`, mesmo que seja "como funciona o saque?". Isso já é filtrado pelo guard de `forbidFinancial`, mas sem flow context (autopilot global), o OTP seria enviado para uma pergunta informativa.

**Fix:** Considerar para o futuro. Não é urgente porque no contexto de fluxo o guard já protege.

## Plano de Correções

### 1. Fix Bug 1 — Skip OTP para ambíguos em flow context

Em `ai-autopilot-chat/index.ts` (~linha 6018-6028), quando `forbidFinancial + !isWithdrawalActionClear`:
- Adicionar uma flag `skipOTPForDisambiguation = true`
- Usar essa flag para pular todo o bloco OTP (wrap o bloco 6030-6120+ com `if (!skipOTPForDisambiguation)`)

### 2. Fix Bug 2 — Reconhecer `[[FLOW_EXIT:intent]]`

Em `ai-autopilot-chat/index.ts`:
- **Linha ~1392** (`ESCAPE_PATTERNS`): Atualizar regex para `/\[\[FLOW_EXIT(:[a-zA-Z_]+)?\]\]/i`
- **Linha ~8619** (`isCleanExit`): Atualizar regex para `/^\s*\[\[FLOW_EXIT(:[a-zA-Z_]+)?\]\]\s*$/`
- **Linha ~8637-8645**: Extrair intent do token e incluir na response como `ai_exit_intent: 'financeiro'`
- **Linha ~8384** (segundo ESCAPE_PATTERNS): Mesma atualização

### 3. Fix no webhook — Propagar `ai_exit_intent` do flowExit

Em `meta-whatsapp-webhook/index.ts`, no handler de `flowExit` (~linha 1619+):
- Quando re-invocar `process-chat-flow`, incluir `intentData: { ai_exit_intent }` extraído da resposta do autopilot

## Arquivos Modificados

| Arquivo | Mudanças |
|---|---|
| `supabase/functions/ai-autopilot-chat/index.ts` | Fix OTP skip, Fix regex FLOW_EXIT, extrair intent |
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Propagar ai_exit_intent no flowExit handler |

