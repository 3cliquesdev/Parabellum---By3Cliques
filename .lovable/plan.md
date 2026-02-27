

# Fix: Trava Financeira — Interceptação na Entrada + Avanço de Fluxo

## Resumo

A trava financeira (`forbidFinancial`) hoje só valida a **saída** da IA (pós-resposta, linha 7799-7815 do `ai-autopilot-chat`). A IA ainda processa e responde com opções financeiras antes da validação. O fix adiciona interceptação na **entrada** (antes de chamar o LLM), reforça o pós-resposta e garante avanço de nó no flow engine.

## Implementação

### 1. `ai-autopilot-chat/index.ts` — Interceptação na entrada (early return)

**Após linha 1297** (onde `flowForbidFinancial` é logado), antes do `try` na linha 1300:

- Criar `financialIntentPattern` regex separado do `financialResolutionPattern`
- Se `flowForbidFinancial === true` E `customerMessage` bate no pattern:
  - Atualizar conversa: `ai_mode: 'waiting_human'`, `assigned_to: null`
  - Registrar `ai_events` com `event_type: 'ai_blocked_financial'`
  - Retornar JSON com `financialBlocked: true`, `exitKeywordDetected: true`, mensagem fixa de transferência
  - **Não chamar o LLM**

### 2. `ai-autopilot-chat/index.ts` — Expandir regex pós-resposta (linha 7801)

Expandir `financialResolutionPattern` para também capturar:
- Apresentação de opções financeiras: `op[çc][ãa]o.*(saque|reembolso|estorno)`
- Procedimentos financeiros: `para prosseguir com o (saque|reembolso)`, `confirmar.*dados.*(saque|reembolso)`
- Cancelamentos: `cancelar.*assinatura`, `sacar.*saldo`

### 3. `process-chat-flow/index.ts` — Tratar `financialBlocked` como exit

**Na seção de AI persistent (linhas 1156-1260)**, adicionar check antes do `exitKeywords`/`maxInteractions`:

- Detectar intenção financeira no `userMessage` usando o mesmo `financialIntentPattern`
- Se `forbid_financial === true` E match detectado:
  - Limpar `collectedData.__ai`
  - Logar em `ai_events`
  - Cair no `findNextNode` normal (linha 1263) — avança para próximo nó do fluxo

### 4. `meta-whatsapp-webhook/index.ts` — Sem mudança estrutural

O webhook já delega para `ai-autopilot-chat` passando `forbidFinancial` no `flow_context` (linha 933). O early return do passo 1 já cobre este cenário — o webhook receberá a resposta com `financialBlocked: true` e a mensagem fixa.

## Arquivos impactados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/ai-autopilot-chat/index.ts` | Early return (entrada) + regex expandida (saída) |
| `supabase/functions/process-chat-flow/index.ts` | Detecção de intenção financeira como exit do nó AI |

## Checklist de testes

- `forbidFinancial=true` + "Devolução saldo" → não chama IA, msg fixa, `waiting_human`
- `forbidFinancial=false` + "Devolução saldo" → fluxo normal
- `forbidFinancial=true` + "Qual horário?" → não bloqueia
- IA respondeu algo financeiro (bypass) → pós-validação bloqueia
- `financialBlocked` → `process-chat-flow` avança nó

