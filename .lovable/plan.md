

# Auditoria Modo Jarvis — Falha Crítica Encontrada

## Diagnóstico

A alteração feita na **linha 9229** (`forbidQuestions = false`) corrige apenas a **validação pós-resposta** (depois que a IA já gerou o texto). Porém, a IA ainda está sendo bloqueada **ANTES** de responder, em **3 outros pontos** do código:

### Pontos onde `forbidQuestions` ainda bloqueia perguntas:

| Local | Linha | Impacto |
|---|---|---|
| `generateRestrictedPrompt()` | **1225** | Adiciona `"NÃO faça perguntas ao cliente"` no **system prompt** — a IA recebe instrução direta de não perguntar |
| `flowForbidQuestions` | **1516** | Define `forbidQuestions: true` por default, ativa o modo restritivo |
| `flow_context` builder | **3523** | `forbidQuestions: flowResult.forbidQuestions ?? true` — default `true` quando o fluxo não especifica |

**Resultado**: Mesmo com o override na linha 9229, o prompt da IA ainda diz "NÃO faça perguntas ao cliente", então a IA obedece e não pergunta.

## Correções Necessárias (3 pontos adicionais)

### 1. `generateRestrictedPrompt` — Linha 1225
```typescript
// DE:
const forbidQuestions = flowContext.forbidQuestions ?? true;
// PARA:
const forbidQuestions = false; // 🤖 OVERRIDDEN PARA MODO JARVIS
```
Isso remove a instrução "NÃO faça perguntas" do system prompt.

### 2. `flow_context` builder — Linha 3523
```typescript
// DE:
forbidQuestions: flowResult.forbidQuestions ?? true,
// PARA:
forbidQuestions: flowResult.forbidQuestions ?? false, // 🤖 JARVIS: default permite perguntas
```
Isso garante que o default quando o fluxo não especifica é **permitir** perguntas.

### 3. `flowForbidQuestions` — Linha 1516
```typescript
// DE:
const flowForbidQuestions: boolean = flow_context?.forbidQuestions ?? true;
// PARA:
const flowForbidQuestions: boolean = false; // 🤖 OVERRIDDEN PARA MODO JARVIS
```

### 4. Verificação da alteração anterior (já aplicada)
- ✅ Linha 9229: `forbidQuestions = false` — **OK**
- ✅ Linhas 6596-6608: `flowAntiTransferInstruction` com instrução de FAZER PERGUNTAS — **OK**

### 5. Deploy
Após as 3 correções, deploy imediato da `ai-autopilot-chat`.

## Resumo
Sem essas 3 correções adicionais, o Modo Jarvis está **parcialmente quebrado** — a validação pós-resposta não bloqueia mais perguntas, mas o **prompt da IA ainda instrui ela a não perguntar**, anulando o efeito desejado.

