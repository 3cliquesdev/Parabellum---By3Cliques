

# Auditoria Final — Prontos para Testar?

## Resumo: 5 call sites com bugs remanescentes (não corrigidos na última iteração)

A última correção aplicou os fixes de `category` e `assignedTo` **apenas em alguns** call sites. Faltaram 5 de 9 total.

---

## Call sites CORRIGIDOS (OK)
| Linha | category | assignedTo |
|-------|----------|------------|
| 2047 | `actionData.category \|\| actionData.ticket_category` | `actionData.assigned_to` |
| 4556 (auto-advance) | `actionData.category \|\| actionData.ticket_category` | `actionData.assigned_to` |
| 5357 (Master Flow end) | `actionData.category \|\| actionData.ticket_category` | `actionData.assigned_to` |

## Call sites com BUG (faltam fixes)

### Bug A: `category` usa apenas `ticket_category` (ignora `category` da UI)
| Linha | Contexto |
|-------|----------|
| 2280 | OTP success → end create_ticket |
| 2462 | OTP max_attempts → end create_ticket |
| 2902 | Generic EndNode after option matching |
| 4174 | EndNode after AI advance |
| 5731 | Triggered flow startNode |

### Bug B: `assignedTo` ausente (ticket criado sem responsável)
| Linha | Contexto |
|-------|----------|
| 2276 | OTP success (sem `assignedTo`) |
| 2458 | OTP max_attempts (sem `assignedTo`) |
| 2899 | Generic EndNode (sem `assignedTo`) |
| 4167 | EndNode after AI (sem `assignedTo`) |
| 5727 | Triggered flow (sem `assignedTo`) |

---

## Demais verificações (OK)

| Item | Status |
|------|--------|
| `buildVariablesContext` aliases (`customer_name` etc) | OK (linha 466-468) |
| `createTicketFromFlow` aceita `assignedTo` | OK (linha 281, 328) |
| Transfers usam `transition-conversation-state` | OK (todas as 10+ ocorrências) |
| AI-to-AI transitions via `engage_ai` | OK (transferAiMode === 'autopilot' → 'engage_ai') |
| Handoff para humano | OK (fallback 'handoff_to_human') |
| Copilot transition | OK (transferAiMode === 'copilot' → 'set_copilot') |
| Variáveis clicáveis (UI) | OK |
| Cores das edges (UI) | OK |
| `replaceVariables` | OK |
| Idempotência de ticket | OK (idempotency_key) |
| `use_collected_data` snapshot | OK |

---

## Plano de Correção

### Arquivo: `supabase/functions/process-chat-flow/index.ts`

**5 locais** precisam de 2 alterações cada:

1. **Linha 2280** — trocar `actionData.ticket_category` por `actionData.category || actionData.ticket_category`
2. **Linha 2276-2284** — adicionar `assignedTo: actionData.assigned_to || resolvedNode.data.assigned_to || null`
3. **Linha 2462** — trocar `actionData.ticket_category` por `actionData.category || actionData.ticket_category`
4. **Linha 2458-2466** — adicionar `assignedTo: actionData.assigned_to || resolvedNode.data.assigned_to || null`
5. **Linha 2902** — trocar `actionData.ticket_category` por `actionData.category || actionData.ticket_category`
6. **Linha 2899-2906** — adicionar `assignedTo: actionData.assigned_to || nextNode.data.assigned_to || null`
7. **Linha 4174** — trocar `actionData.ticket_category` por `actionData.category || actionData.ticket_category`
8. **Linha 4167-4179** — adicionar `assignedTo: actionData.assigned_to || nextNode.data.assigned_to || null`
9. **Linha 5731** — trocar `actionData.ticket_category` por `actionData.category || actionData.ticket_category`
10. **Linha 5727-5735** — adicionar `assignedTo: actionData.assigned_to || startNode.data.assigned_to || null`

### Total: ~10 linhas alteradas em 1 arquivo

### Resultado
Após este fix, **100% dos 9 call sites** de `createTicketFromFlow` terão `category` e `assignedTo` corretos. O fluxo de saque poderá criar tickets com categoria, responsável e variáveis substituídas corretamente.

