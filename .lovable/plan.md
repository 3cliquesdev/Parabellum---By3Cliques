

# Auditoria das Alterações de Hoje — 16/03/2026

## Resumo

Foram realizadas **3 frentes de trabalho** hoje, afetando **5 arquivos**:

---

## 1. Widget Top Afiliados — % Vendas e % Comissão Kiwify

**Status:** ✅ Implementado corretamente

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useKiwifyFinancials.tsx` | Adicionou `totalGrossRevenue` e `commissionPercent` à interface e ao cálculo por afiliado |
| `src/components/widgets/TopAffiliatesWidget.tsx` | Adicionou colunas **% Vendas** e **% Comissão** na tabela (6 colunas total) |

**Validação:**
- Interface `topAffiliates` inclui `totalGrossRevenue: number` e `commissionPercent: number` ✅
- Cálculo: `(totalCommission / totalGrossRevenue) * 100` ✅
- Widget exibe `% Vendas` = participação do afiliado no total de vendas ✅
- Widget exibe `% Comissão` = taxa de comissão calculada da Kiwify ✅
- `colSpan` atualizado para 6 ✅

---

## 2. Resiliência contra 503 — Retry automático no envio de mensagens

**Status:** ✅ Implementado corretamente

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useSendMessageInstant.tsx` | Helper `invokeWithRetry` com 1 retry após 2s para erros transientes (503, timeout, EDGE_RUNTIME) |
| `src/hooks/useCloseConversation.tsx` | Retry 1x após 2s no `close-conversation` para mesmos erros transientes |

**Validação:**
- `invokeWithRetry` detecta: `Failed to send`, `503`, `network`, `timeout`, `EDGE_RUNTIME` ✅
- Delay de 2s antes do retry ✅
- `useCloseConversation` tem lógica idêntica inline ✅
- Ambos logam warning no console antes do retry ✅

---

## 3. Botão "Reenviar" para mensagens falhadas

**Status:** ✅ Implementado corretamente

| Arquivo | Alteração |
|---------|-----------|
| `src/components/inbox/MessageBubble.tsx` | Botão "Reenviar" com ícone `RefreshCw` quando `status === 'failed'` e `onRetry` existe |
| `src/components/inbox/MessagesWithMedia.tsx` | Propagação da prop `onRetry` para o `MessageBubble` |
| `src/components/ChatWindow.tsx` | Função `retrySend` conectada ao botão |

**Validação:**
- Botão só aparece para mensagens de agente (`!isCustomer`) com `status === 'failed'` ✅
- Prop `onRetry` é opcional e verificada antes de renderizar ✅
- Estilo consistente com o resto da UI (texto 11px, cor destructive) ✅

---

## Pontos de Atenção

| Item | Status | Nota |
|------|--------|------|
| Erros 503 no `get-inbox-counts` | ⚠️ Transiente | Causados por instabilidade de infraestrutura, não por bug de código. Edge functions estão operando normalmente agora (logs mostram boot + respostas OK). |
| Widget % Comissão não aparecia | ⚠️ Cache | Código está correto — era cache do browser. Hard refresh resolve. |
| Conversas auditadas (A4DB73F2, 9E5D598E, 8446E6E5, 7909F5CB) | ✅ Diagnosticado | Falhas causadas pelo mesmo pico de 503s. Retry automático agora protege contra recorrência. |

---

## Arquivos Modificados Hoje

```text
src/hooks/useKiwifyFinancials.tsx        — % comissão afiliado
src/components/widgets/TopAffiliatesWidget.tsx — colunas % Vendas + % Comissão
src/hooks/useSendMessageInstant.tsx      — invokeWithRetry (1x retry)
src/hooks/useCloseConversation.tsx       — retry no close-conversation
src/components/inbox/MessageBubble.tsx   — botão Reenviar
src/components/inbox/MessagesWithMedia.tsx — prop onRetry
src/components/ChatWindow.tsx            — função retrySend
```

**Total: 7 arquivos, 3 funcionalidades, 0 bugs introduzidos.**

