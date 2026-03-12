

# Auditoria Final — BUG CRÍTICO no Roteamento Financeiro

## O Problema (CRÍTICO)

Quando a regex `financialActionPattern` detecta uma ação financeira diretamente no `process-chat-flow` (via `forceFinancialExit` do webhook), o `path` NÃO é setado para `'ai_exit'`. Resultado:

```text
FLUXO ESPERADO:
  financialIntentMatch → path='ai_exit' → findNextNode → condition_v2 "Roteamento de Intenção" → ramo Financeiro

FLUXO REAL:
  financialIntentMatch → path=undefined → findNextNode → edge DEFAULT (sem handle) → NÓ ERRADO ou null
```

O `path = 'ai_exit'` é setado APENAS para `aiExitForced` (linha 2283), mas `forceFinancialExit` NÃO seta `forceAIExit` — são flags separadas. Isso significa:

| Cenário | path | Resultado |
|---|---|---|
| `[[FLOW_EXIT]]` (IA pede saída) | `ai_exit` ✅ | Chega no "Roteamento de Intenção" |
| `forceFinancialExit` (regex direta) | `undefined` ❌ | Pega edge default ou null → handoff genérico |

### Impacto

O nó "Roteamento de Intenção" (condition_v2) que verifica `ai_exit_intent` para decidir entre "Financeiro" e "Cancelamento" **NUNCA é alcançado** no cenário de detecção direta via regex. A conversa cai no fallback de handoff genérico (linha 2348) em vez de seguir o ramo visual do fluxo (Verificar Cliente → OTP → Coleta PIX).

### O que funciona

- `ai_exit_intent = 'financeiro'` É salvo corretamente no `collectedData` (linha 2220-2222) ✅
- Quando a IA retorna `[[FLOW_EXIT]]`, o webhook usa `forceAIExit=true` → `path='ai_exit'` → chega no condition_v2 ✅
- A `financialGuardInstruction` no prompt está ativa e funcional ✅

## Correção (1 linha)

**Arquivo**: `supabase/functions/process-chat-flow/index.ts`

Após a linha 2282 onde `aiExitForced` seta `path = 'ai_exit'`, adicionar o mesmo para `financialIntentMatch` e `commercialIntentMatch`:

```typescript
// Linha ~2283 (existente):
if (aiExitForced) {
  path = 'ai_exit';
}

// ADICIONAR:
if (financialIntentMatch || commercialIntentMatch) {
  path = 'ai_exit';
  console.log(`[process-chat-flow] 🎯 financial/commercial exit → path set to "ai_exit"`);
}
```

Isso garante que tanto o exit via `[[FLOW_EXIT]]` quanto o exit via regex financeira/comercial seguem a mesma edge `ai_exit` → "Roteamento de Intenção" → ramo correto.

## Validação do Ramo (nó a nó)

Após a correção, o fluxo visual funciona assim:

1. **IA Suporte (Entrada)** — `ai_response` com `forbid_financial=true` → detecta "quero sacar" → `financialIntentMatch` → `path='ai_exit'`
2. **findNextNode** → segue edge com handle `ai_exit` → **Roteamento de Intenção** (condition_v2)
3. **Roteamento de Intenção** — avalia regra `ai_exit_intent` no `collectedData`:
   - `'financeiro'` → handle da regra "Financeiro" → ramo de verificação
   - `'comercial'` → handle da regra "Cancelamento"  
   - Nenhum match → handle "Outros"
4. **Segurança** → mensagem de segurança
5. **Verificar Cliente + OTP** → validação
6. **OTP Verificado?** → Sim/Não
7. **Confirmado** → Coleta Nome → Chave PIX → Banco → Motivo Financeiro → Ticket

## Resultado Esperado

| Mensagem | Antes | Depois |
|---|---|---|
| "Quero sacar meu saldo" | Handoff genérico (path=undefined) | Segue ramo Financeiro visual |
| "Cadê meu dinheiro" | Handoff genérico | Segue ramo Financeiro visual |
| `[[FLOW_EXIT]]` financeiro | ✅ Já funciona | ✅ Mantém |

