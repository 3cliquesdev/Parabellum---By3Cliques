

# Auditoria v6: process-chat-flow — Bug Sistêmico Encontrado

Após reler todas as 5211 linhas com os 27 fixes anteriores (1-9, A-T) aplicados, encontrei **1 bug sistêmico** com **10 ocorrências** que afeta silenciosamente a criação de tickets e aplicação de tags em TODA a zona de fluxo ativo.

---

## Bug U: `activeState.conversations?.contact_id` é SEMPRE `undefined`

**Causa raiz**: A query que carrega o activeState (L1506-1512) é:
```typescript
.select('*, chat_flows(*)')
```
Ela faz JOIN apenas com `chat_flows`, **nunca** com `conversations`. Portanto `activeState.conversations` é **sempre `undefined`**.

**Impacto**: Em 10 locais, o motor usa `activeState.conversations?.contact_id` para:
- `contactId` em `createTicketFromFlow()` → tickets criados SEM `customer_id`
- `else if (activeState.conversations?.contact_id)` em `add_tag` → tags de contato **NUNCA** são aplicadas

A variável correta é `activeContactData?.id` (declarada em L1576, populada em L1586-1593).

**Nota**: Os fixes P, Q e R (OTP paths) já usam `activeContactData?.id` corretamente. Mas TODOS os handlers originais do fluxo ativo (main end, generic ask_*, auto-advance, message chain) usam a referência errada.

### 10 ocorrências a corrigir

| # | Linha | Zona | Uso |
|---|-------|------|-----|
| 1 | L2232 | OTP max_attempts → end (Bug H) | `contactId: activeState.conversations?.contact_id` |
| 2 | L2248 | OTP max_attempts → end (Bug H) | `else if (activeState.conversations?.contact_id)` |
| 3 | L2249 | OTP max_attempts → end (Bug H) | `contact_id: activeState.conversations.contact_id` |
| 4 | L2492 | Generic ask_* auto-advance create_ticket | `contactId: activeState.conversations?.contact_id` |
| 5 | L2581 | Generic ask_* end create_ticket | `contactId: activeState.conversations?.contact_id` |
| 6 | L2596 | Generic ask_* end add_tag | `else if (activeState.conversations?.contact_id)` |
| 7 | L2597 | Generic ask_* end add_tag | `contact_id: activeState.conversations.contact_id` |
| 8 | L3673 | Main end create_ticket | `contactId: activeState.conversations?.contact_id` |
| 9 | L3702 | Main end add_tag | `else if (activeState.conversations?.contact_id)` |
| 10 | L3703 | Main end add_tag | `contact_id: activeState.conversations.contact_id` |
| 11 | L3895 | Main auto-advance create_ticket | `contactId: activeState.conversations?.contact_id` |
| 12 | L4027 | End after msg chain create_ticket | `contactId: activeState.conversations?.contact_id` |
| 13 | L4049 | End after msg chain add_tag | `else if (activeState.conversations?.contact_id)` |
| 14 | L4051 | End after msg chain add_tag | `contact_id: activeState.conversations.contact_id` |

**Fix**: Substituir TODAS as 14 ocorrências de `activeState.conversations?.contact_id` e `activeState.conversations.contact_id` por `activeContactData?.id`.

---

## Bug V: OTP max_attempts → ai_response NÃO inicializa `__ai`

**Local**: L2265-2281
**Impacto**: Quando OTP max_attempts resolve para `ai_response`, o motor retorna `aiNodeActive: true` mas NÃO:
1. Inicializa `collectedData.__ai = { interaction_count: 0 }`
2. Atualiza `current_node_id` e `status: 'active'`
3. Retorna campos de controle (persona, forbid_*, allowedSources)

Compare com Bug S fix (L2082-2117) que faz os 3 corretamente. Este é o ÚNICO path OTP que ficou sem handler dedicado para ai_response.

**Fix**: Adicionar bloco `if (resolvedNode.type === 'ai_response')` antes do retorno genérico (L2265), com inicialização `__ai`, update de state, e campos completos de controle.

---

## Resumo

| Bug | Tipo | Ocorrências | Impacto |
|-----|------|-------------|---------|
| U | Referência undefined | 14 substituições | Tickets sem customer_id, tags de contato nunca aplicadas |
| V | Inicialização faltante | 1 bloco | AI counter incorreto, status errado no OTP max_attempts |

## Arquivo

- `supabase/functions/process-chat-flow/index.ts` — 2 edições (Bug U: 14 substituições em massa, Bug V: 1 bloco expandido)

