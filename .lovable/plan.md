

# Auditoria Completa — Resultados

## ✅ O Que Está Correto

### 1. ReengageTemplateDialog.tsx — 100%
- Guard `isAlreadyOpen` funciona corretamente (linha 198)
- Botão desabilita durante `isPending` (linha 294)
- Spinner + "Enviando..." exibido (linhas 296-301)
- Navegação pós-envio para `/inbox?filter=mine` (linha 169)
- Invalidação de queries correta (linhas 157-159)

### 2. dispatch-conversations/index.ts — 100%
- Tag aplicada em `conversation_tags` (linha 899) — fix correto
- Tag protegida em `protected_conversation_tags` (linha 904)

### 3. DepartmentDialog.tsx — 100%
- Toggle `afterHoursKeepOpen` presente (linha 28)

### 4. useDepartments.tsx — 100%
- Interface inclui `after_hours_keep_open: boolean` (linha 25)

### 5. auto-close-conversations Stage 6 — Lógica OK
- Query busca `departments:department(after_hours_keep_open)` (linha 1037)
- Flag `keepOpen` verificada corretamente (linhas 1052-1053)
- Mensagem enviada + tag aplicada para ambos os cenários (linhas 1056-1087)
- Conversa mantida aberta se `keepOpen=true` (linhas 1089-1091)
- Conversa fechada + dispatch jobs completados se `keepOpen=false` (linhas 1094-1108)

---

## 🐛 Bug Encontrado (1 item crítico)

### `auto-close-conversations/index.ts` — Linha 1085: Variável indefinida

```typescript
// Linha 1085 (ERRADO):
tag_id: FALTA_INTERACAO_TAG_ID,  // ❌ NÃO EXISTE

// Constante definida na linha 12:
const LEGACY_FALTA_INTERACAO_TAG_ID = '3eb75d67-...'  // ✅ ESTA É A CERTA
```

**Impacto:** Quando `after_hours_tag_id` não está configurado no `business_messages_config`, o fallback tenta usar `FALTA_INTERACAO_TAG_ID` que não existe — causa `ReferenceError` e **interrompe Stage 6 inteiro**, impedindo o encerramento de TODAS as conversas after-hours.

**Fix:** Trocar `FALTA_INTERACAO_TAG_ID` por `LEGACY_FALTA_INTERACAO_TAG_ID` na linha 1085.

---

## Correção Necessária

| Arquivo | Linha | Fix |
|---------|-------|-----|
| `auto-close-conversations/index.ts` | 1085 | `FALTA_INTERACAO_TAG_ID` → `LEGACY_FALTA_INTERACAO_TAG_ID` |

Redeploy da edge function após correção.

