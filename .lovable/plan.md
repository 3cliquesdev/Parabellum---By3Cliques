

# Auditoria Completa: Multi-Intent Routing

## Resumo

Auditei os 5 arquivos alterados. A implementação está **80% correta** — handles, painel lateral e fallback hierarchy funcionam bem. Porém há **1 bug crítico** e **2 problemas menores**.

---

## BUG CRÍTICO: Bloco financeiro executando incondicionalmente

**Arquivo:** `supabase/functions/process-chat-flow/index.ts`, linhas 2196-2220

O bloco de logging e `delete collectedData.__ai` da trava financeira está **fora de qualquer `if`**. Após a linha 2194 (`}` que fecha `if (forceCommercialExit)`), o código nas linhas 2196-2219 roda **em TODA mensagem** para qualquer nó AI, não apenas quando `financialIntentMatch` é verdadeiro.

**Consequências:**
1. Toda interação com nó AI gera um evento falso `ai_blocked_financial` no banco
2. `delete collectedData.__ai` é executado sempre, **destruindo o estado de persistência da IA** — o contador de interações é resetado a cada mensagem
3. A `}` na linha 2220 fecha prematuramente um bloco exterior, causando desalinhamento estrutural

**Correção:** Envolver linhas 2196-2219 em `if (financialIntentMatch) {` e ajustar a `}` correspondente.

---

## Problema 2: `keywordMatch` e `aiExitForced` roteados para 'suporte'

**Linha 2386-2389:** Quando o exit é por keyword ou `aiExitForced` (IA não conseguiu resolver), o path é definido como `'suporte'` e `ai_exit_intent` é forçado para `'suporte'`.

Isso pode ser incorreto para `aiExitForced` — quando a IA simplesmente não resolve (strict RAG, low confidence), a saída deveria ser pelo handle `'default'`, não `'suporte'`. Apenas `keywordMatch` (que tipicamente contém "atendente", "humano") faz sentido ir para suporte.

**Correção sugerida:** Separar: `keywordMatch → 'suporte'`, `aiExitForced → 'default'`.

---

## Problema 3: `forbidCancellation` fallback para `forbidFinancial`

**Linha 2127:**
```typescript
const forbidCancellation = currentNode.data?.forbid_cancellation ?? forbidFinancial;
```

Se o usuário ativar apenas "Financeiro" no painel, "Cancelamento" também será ativado automaticamente como efeito colateral. Isso contradiz os toggles independentes no painel lateral. O fallback deveria ser `false`.

---

## O que está CORRETO

| Componente | Status |
|---|---|
| AIResponseNode — 5 handles com `pointer-events-none` | ✅ OK |
| BehaviorControlsSection — 4 toggles independentes | ✅ OK |
| ChatFlowEditor — defaults `false` para novos campos | ✅ OK |
| findNextNode — hierarquia path → ai_exit → default → any | ✅ OK |
| Intent detection — regex financeiro/cancelamento/comercial/suporte | ✅ OK |
| ai_exit_intent auto-save no collectedData | ✅ OK |
| Handoff fallback quando nextNode=null | ✅ OK |
| Badges visuais no nó + painel lateral | ✅ OK |
| Propagação dos 4 forbid flags em todas as respostas AI | ✅ OK |

---

## Plano de Correção

1. **Linha 2196:** Adicionar `if (financialIntentMatch) {` antes do console.log
2. **Linha 2127:** Mudar fallback de `forbidFinancial` para `false`
3. **Linhas 2386-2389:** Separar `keywordMatch` (→ suporte) de `aiExitForced` (→ default)

Todas as correções são no arquivo `process-chat-flow/index.ts`.

