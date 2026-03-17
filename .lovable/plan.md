

# Auditoria Completa — Bugs Encontrados

## Status Geral
A UI (variáveis clicáveis, cores de edges) está funcional. Porém encontrei **3 bugs críticos** que impediriam o ticket de funcionar corretamente no fluxo de saque.

---

## Bug 1: `category` vs `ticket_category` — CRÍTICO
**Impacto**: Categoria do ticket sempre cai em "outro", ignorando a seleção do usuário.

- A UI (`AIResponsePropertiesPanel.tsx` linha 303) salva em `action_data.category`
- O motor (`process-chat-flow/index.ts` linha 2045) lê `actionData.ticket_category`
- Como `ticket_category` nunca existe no `action_data`, cai no fallback `'outro'`

**Fix**: No motor, em TODOS os `end_action === 'create_ticket'`, alterar para ler `actionData.category || actionData.ticket_category || ...`

---

## Bug 2: `assigned_to` não é passado para `createTicketFromFlow` — CRÍTICO
**Impacto**: Mesmo selecionando um responsável na UI, o ticket é criado sem responsável.

- A função `createTicketFromFlow` (linha 269-355) não tem `assigned_to` nos parâmetros
- O `insertPayload` (linha 315) nunca inclui `assigned_to`
- A UI salva corretamente em `action_data.assigned_to`, mas ninguém lê esse valor

**Fix**: Adicionar `assignedTo?: string | null` na interface da função e incluir no `insertPayload`

---

## Bug 3: Variáveis de sistema com nomes errados — MODERADO
**Impacto**: `{{customer_name}}`, `{{customer_email}}`, `{{customer_phone}}` nos badges não são substituídos no ticket.

- A UI usa `customer_name`, `customer_email`, `customer_phone`
- O motor gera `contact_name`, `contact_email`, `contact_phone` (linha 456-462 do `buildVariablesContext`)
- `replaceVariables()` não encontra match e deixa o texto literal `{{customer_name}}`

**Fix**: Adicionar aliases no `buildVariablesContext`: `ctx['customer_name'] = ctx['contact_name']`, etc.

---

## O que está OK ✅
1. **Variáveis clicáveis** — UI funciona, insere `{{var}}` nos campos
2. **Cores das edges** — `getEdgeColorFromSource` mapeia corretamente as cores das opções
3. **replaceVariables** — função genérica funciona se as chaves existirem
4. **collectedData** — pix_key, bank, amount, reason são corretamente incluídos no context via `{ ...collectedData }`
5. **Idempotência** — `createTicketFromFlow` verifica ticket duplicado por chave
6. **use_collected_data** — snapshot é salvo no metadata do ticket
7. **departmentId** — é passado corretamente do `action_data` para a função

---

## Plano de Correção

### Arquivo 1: `supabase/functions/process-chat-flow/index.ts`

**A) Função `createTicketFromFlow`** — adicionar parâmetro `assignedTo` e incluir no `insertPayload`

**B) `buildVariablesContext`** — adicionar aliases:
```
ctx['customer_name'] = ctx['contact_name']
ctx['customer_email'] = ctx['contact_email']  
ctx['customer_phone'] = ctx['contact_phone']
```

**C) Todas as chamadas `end_action === 'create_ticket'`** (~8 ocorrências) — duas mudanças:
1. Ler `actionData.category` em vez de `actionData.ticket_category`
2. Passar `assignedTo: actionData.assigned_to || resolvedNode.data.assigned_to || null`

**D) Todas as chamadas de `createTicketFromFlow` em nós `create_ticket` diretos** (~3 ocorrências) — passar `assignedTo: nextNode.data?.assigned_to || null`

### Total: ~25 linhas alteradas em 1 arquivo (edge function)

