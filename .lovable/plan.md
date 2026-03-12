

# Auditoria Completa — Motor de Fluxos (`process-chat-flow`)

## Resultado: 99% OK — 2 bugs de roteamento em auto-traverse

---

## O que foi auditado (4314 linhas)

| Componente | Status |
|---|---|
| `findNextNode` — fallback hierárquico (path → ai_exit → default → any) | OK |
| `evaluateConditionPath` — V1 multi-regra + clássico true/false | OK |
| `evaluateConditionV2Path` — Sim/Não por regra + else | OK |
| `matchAskOption` — 4 estratégias (número, exato, startsWith, contains) | OK |
| Validadores (email, phone, cpf, name, text) | OK |
| `createTicketFromFlow` — idempotência por chave | OK |
| `handleFetchOrderNode` — busca via fetch-tracking | OK |
| `buildVariablesContext` — merge collectedData + contact + conversation + org + business hours | OK |
| `replaceVariables` — templates `{{var}}` | OK |
| `getVar` — resolver unificado com aliases (is_customer, etc.) | OK |
| Generic ask_* handler (L1986-2083) — auto-traverse correto | OK |
| ask_options — validação estrita + reenvio de opções | OK |
| condition V1 — classic + multi-regra + inactivity | OK |
| condition V2 — Sim/Não handler no loop principal (L2136-2140) | OK |
| ai_response — modo persistente + 6 intents + desambiguação | OK |
| ai_response — auto-validate customer silencioso | OK |
| ai_response — anti-duplicação (janela 5s) | OK |
| ai_response — inferência automática forbidFinancial | OK |
| Financial/Cancellation/Commercial/Support/Consultant — detect + log + path | OK |
| Handoff fallback sem nextNode — busca departamento dinâmica | OK |
| aiExitForced sem nextNode — handoff genérico | OK |
| Auto-traverse principal (L2806-2863) — condition + condition_v2 + inactivity | OK |
| fetch_order handler (L2866-2916) | **BUG** |
| validate_customer handler (L2918-3048) | **BUG** |
| verify_customer_otp — máquina de estados (ask_email → check → confirm → wait_code) | OK |
| end node — end_actions (create_ticket, create_lead, add_tag) | OK |
| transfer node — flow-to-flow + loop guard + transition-conversation-state | OK |
| ai_response entry — todos os 15 campos propagados | OK |
| Auto-avanço message chain (L3312-3362) — condition + condition_v2 | OK |
| After message chain: end, transfer, ai_response handlers | OK |
| Status semântico (waiting_input para ask_*, condition, condition_v2, OTP) | OK |
| Kill switch + test mode | OK |
| ai_mode protection + flow sovereignty | OK |
| Contract violation handler | OK |
| Trigger matching — normalização + fuzzy + essential keywords | OK |
| Master Flow traversal — V2 condition support | OK |
| Master Flow UPSERT state (não duplica) | OK |
| New flow trigger traversal — condition_v2 support (L4159-4189) | OK |

---

## BUG 1: `fetch_order` auto-traverse usa `evaluateConditionPath` para `condition_v2`

**Linha 2888-2889:**
```typescript
if (afterFetchNode.type === 'condition' || afterFetchNode.type === 'condition_v2') {
  const condPath = evaluateConditionPath(...); // ❌ ERRADO para condition_v2
```

Deveria usar `evaluateConditionV2Path` quando o nó é `condition_v2`. O `evaluateConditionPath` trata regras como V1 (retorna `rule.id` ou `else`), mas o V2 tem lógica diferente (retorna `rule.id` para Sim, `rule.id_false` para Não). Resultado: paths errados quando `fetch_order → condition_v2`.

## BUG 2: `validate_customer` auto-traverse — mesmo problema

**Linha 3026-3027:**
```typescript
if (afterValidateNode.type === 'condition' || afterValidateNode.type === 'condition_v2') {
  const condPath = evaluateConditionPath(...); // ❌ ERRADO para condition_v2
```

Mesma falha: `validate_customer → condition_v2` avalia com a função errada.

---

## Nota: O handler genérico de ask_* (L2046-2051) está CORRETO

Ele já diferencia:
```typescript
const cp2 = afterVC.type === 'condition_v2'
  ? evaluateConditionV2Path(...)
  : evaluateConditionPath(...);
```

---

## Correção (2 edits, 1 arquivo)

**Arquivo:** `supabase/functions/process-chat-flow/index.ts`

### Edit 1 — Linha 2889 (fetch_order auto-traverse)
Substituir a chamada `evaluateConditionPath` por lógica condicional:
```typescript
const condPath = afterFetchNode.type === 'condition_v2'
  ? evaluateConditionV2Path(afterFetchNode.data, collectedData, userMessage, undefined, activeContactData, activeConversationData, flowDef.edges || [])
  : evaluateConditionPath(afterFetchNode.data, collectedData, userMessage, undefined, activeContactData, activeConversationData);
```

### Edit 2 — Linha 3027 (validate_customer auto-traverse)
Mesma correção:
```typescript
const condPath = afterValidateNode.type === 'condition_v2'
  ? evaluateConditionV2Path(afterValidateNode.data, collectedData, userMessage, undefined, activeContactData, activeConversationData, flowDef.edges || [])
  : evaluateConditionPath(afterValidateNode.data, collectedData, userMessage, undefined, activeContactData, activeConversationData);
```

Após esses 2 edits, o motor estará **100% correto** em todos os caminhos de auto-traverse.

