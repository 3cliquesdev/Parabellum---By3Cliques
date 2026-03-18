

# Bug 38: `handle-whatsapp-event` NÃO implementa `skipInitialMessage` — IA recebe dígito "2" como mensagem real

## Diagnóstico

**Conversa:** #FF7270C8 (`ff7270c8-cfff-4f9c-be6a-d78f6a3e3695`)  
**Canal:** `whatsapp` (Evolution API → `handle-whatsapp-event`)  
**Fluxo:** V5 Enterprise (`cafe2831`)

### O que acontece

1. Cliente envia "boa tarde" → menu de produtos
2. Seleciona "1" (Drop Nacional) → menu de assuntos
3. Seleciona "2" (Financeiro) → `process-chat-flow` retorna `{ useAI: true, aiNodeActive: true, skipInitialMessage: true, ... }`
4. `handle-whatsapp-event` L1314: entra no bloco `flowResult.useAI && flowResult.aiNodeActive`
5. **NÃO verifica `skipInitialMessage`** — chama `ai-autopilot-chat` direto com `customerMessage: "2"`
6. LLM recebe "2" sem contexto → não encontra nada na KB → fallback: "Não encontrei informações específicas..."

### Causa raiz

O `handle-whatsapp-event` (Evolution API) nunca recebeu a implementação de `skipInitialMessage` que foi feita no `meta-whatsapp-webhook` (L1148-1208). O código vai direto para a chamada da IA sem interceptar o dígito de menu.

### Segundo problema: L2932 response incompleto

O retorno de `process-chat-flow` na transição `ask_options → ai_response` (L2932) está faltando campos críticos comparado com a transição `intent-routing → ai_response` (L4556-4587):

| Campo | L4556 (intent) | L2932 (ask_options) |
|---|---|---|
| `personaId` | ✅ | ❌ |
| `kbCategories` | ✅ | ❌ |
| `kbProductFilter` | ✅ | ❌ |
| `objective` | ✅ | ❌ |
| `fallbackMessage` | ✅ | ❌ |
| `maxSentences` | ✅ | ❌ |
| `forbidQuestions` | ✅ | ❌ |
| `forbidOptions` | ✅ | ❌ |
| `forbidFinancial` | ✅ | ❌ |
| `forbidCommercial` | ✅ | ❌ |
| `forbidCancellation` | ✅ | ❌ |
| `forbidConsultant` | ✅ | ❌ |
| `forbidSupport` | ✅ | ❌ |
| `allowedSources` | ✅ | ❌ |

Isso significa que, mesmo se a saudação fosse enviada, as mensagens subsequentes no nó teriam configuração incorreta (sem persona, sem filtro de KB, sem flags de proteção).

## Plano de Correção

### Fix 1: `handle-whatsapp-event` — Adicionar `skipInitialMessage` (L1314)

Antes de chamar `ai-autopilot-chat`, verificar se `flowResult.skipInitialMessage === true`. Se sim, chamar a IA com `customerMessage: ""` (mensagem vazia) para acionar a saudação proativa, idêntico ao `meta-whatsapp-webhook` L1148-1208.

### Fix 2: `process-chat-flow` L2932 — Enriquecer response `ask_options → ai_response`

Expandir o response para incluir todos os campos do nó AI (`personaId`, `kbProductFilter`, `objective`, `fallbackMessage`, `forbidQuestions`, etc.), alinhando com o retorno de L4556-4587.

### Resumo: 2 arquivos, 2 edições

1. **`supabase/functions/handle-whatsapp-event/index.ts`** L1314: Interceptar `skipInitialMessage` e chamar IA com mensagem vazia
2. **`supabase/functions/process-chat-flow/index.ts`** L2932: Expandir campos retornados na transição ask_options → ai_response

