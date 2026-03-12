

# Auditoria: Validação Kiwify — 3 pontos pendentes

## Diagnóstico Completo

A correção no `process-chat-flow` está correta (inline query), mas existem **mais 2 funções** que ainda usam `functions.invoke('validate-by-kiwify-phone')` e estão falhando silenciosamente (zero logs na função destino):

| Função | Linha | Status |
|--------|-------|--------|
| `process-chat-flow` | — | ✅ Corrigido (inline) |
| `handle-whatsapp-event` | 958 | ❌ Ainda usa `functions.invoke` |
| `ai-autopilot-chat` | 2733 | ❌ Ainda usa `functions.invoke` |

**Dados reais:** Existem contatos como Yasmin, André Ribeiro, Igor Sena que TÊM compras na Kiwify mas continuam como `lead` com `kiwify_validated=false`.

## Correção (3 partes)

### 1. `handle-whatsapp-event/index.ts` — Inline query (linhas 956-972)
Substituir o bloco `supabase.functions.invoke('validate-by-kiwify-phone')` por query direta à `kiwify_events`, mesmo padrão já usado no `process-chat-flow`:
- Normalizar telefone → últimos 9 dígitos
- Query `kiwify_events` WHERE `payload->Customer->>mobile ILIKE '%{last9}'`
- Se encontrar, setar `targetDepartmentId = SUPORTE_DEPT_ID` e atualizar contato

### 2. `ai-autopilot-chat/index.ts` — Inline query (linhas 2731-2736)
Substituir `supabase.functions.invoke('validate-by-kiwify-phone')` por query direta, mantendo a mesma estrutura de `Promise.allSettled` e o formato de retorno `{ data: { found, customer } }`.

### 3. Corrigir leads existentes — Executar `batch-validate-kiwify-contacts`
A edge function `batch-validate-kiwify-contacts` já existe e faz exatamente isso (query direta, sem invoke). Executar uma vez para corrigir os leads que já deveriam ser clientes.

## Resultado esperado
- Novas mensagens: validação funciona em **todos** os 3 pontos de entrada (webhook, autopilot, flow engine)
- Leads existentes: corrigidos pelo batch
- Zero dependência de chamadas HTTP internas entre edge functions

