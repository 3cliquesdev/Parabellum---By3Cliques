

# As 5 correções já estão aplicadas

Verifiquei cada uma das 5 correções no código atual:

| Fix | Status | Evidência |
|-----|--------|-----------|
| FIX 1 — FALLBACK_PHRASES | ✅ Já aplicado | Linha 718-741, array idêntico ao solicitado |
| FIX 2 — rawAIContent fallback | ✅ Já aplicado | Linha 6980-6983, com check de empty content |
| FIX 3 — customerMessage key | ✅ Já aplicado | Nenhuma ocorrência de `userMessage: customerMessage` encontrada |
| FIX 4 — Mensagens de erro | ✅ Já aplicado | Linhas 9388 e 9524 já usam "Estou com instabilidade..." |
| FIX 5 — FLOW_EXIT antes de strip | ✅ Já aplicado | Linhas 8530-8538, com comentário confirmando remoção do pattern |

---

# Build errors reais (pré-existentes)

Os erros de build são problemas de TypeScript não relacionados às 5 correções. Plano para corrigi-los:

### `ai-autopilot-chat/index.ts` (9 erros)

1. **PromiseLike vs Promise** (linhas 1798, 1810, 1822, 1833): Supabase queries retornam `PromiseLike`, mas o array é tipado como `Promise<any>[]`. Corrigir tipagem para `PromiseLike<any>[]`.

2. **const customerMessage reassignment** (linha 3596): `customerMessage` é `const` mas é reatribuído. Trocar para `let` na declaração original.

3. **`.catch()` em PromiseLike** (linhas 4780, 5254, 5435, 8475, 8523, 8806, 8835, 8873): Supabase retorna `PromiseLike` que não tem `.catch()`. Envolver com `Promise.resolve()` ou usar `try/catch`.

4. **`.catch()` em PostgrestFilterBuilder** (linhas 8577, 8888): Insert sem `.then()` retorna builder, não promise. Adicionar `.then()` antes de `.catch()`.

5. **collectedData em FlowContext** (linhas 9187-9189): Propriedade não declarada no tipo. Adicionar optional chaining com cast `as any` ou estender a interface.

### `ai-governor/index.ts` (1 erro)
6. **brandName used before declaration** (linha 731): Reordenar declaração.

### `auto-close-conversations/index.ts` (1 erro)
7. **DepartmentConfig missing properties**: Atualizar interface ou query select.

### `handle-whatsapp-event/index.ts` (2 erros)
8. **instanceId not found** (linha 1374): Usar `instance` em vez de `instanceId`.
9. **Implicit any** (linha 977): Adicionar tipo ao parâmetro.

### `inbound-email/index.ts` (1 erro)
10. **ticket_number missing** from select: Adicionar ao select query.

### `meta-whatsapp-webhook/index.ts` (3 erros)
11. **customer_metadata missing** from conversation type (linha 574): Adicionar ao select.
12. **department_id missing** (linha 828): Adicionar ao select.
13. **PostgrestFilterBuilder not array** (linha 834): Await a query before using.

### Resumo
- 17 erros de TypeScript em 6 edge functions
- Nenhum relacionado às 5 correções solicitadas — todos pré-existentes
- Correções são tipagem/casting, não lógica de negócio

