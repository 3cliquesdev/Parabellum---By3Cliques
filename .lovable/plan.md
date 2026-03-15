

# Auditoria Completa: IA, Chat Flows, Personas, Inbox

## Status Geral: ⚠️ 3 problemas encontrados (1 crítico, 2 menores)

---

## ✅ O QUE ESTÁ OK

### Edge Functions — Código fonte
- **`ai-autopilot-chat`** (9791 linhas): RAG config, model sanitization, fallback/recovery, anti-loop, closure system, financial OTP — tudo coerente
- **`handle-whatsapp-event`**: Bypasses de `awaiting_close_confirmation`, propagação de `intentData`, paridade Meta/Evolution
- **`process-chat-flow`**: Variáveis de intent declaradas (fix anterior aplicado), greeting guard, desambiguação financeira/cancelamento/comercial/consultor

### Personas & Config
- `usePersonas`, `useUpdatePersona`, `useCreatePersona` — CRUD completo sem problemas
- `PersonaDialog` — TemperaturePreview integrado, data_access controls, KB categories
- `useAIGlobalConfig` — Toggle global funcional com fallback seguro
- `useAIMode` — Realtime subscription para mudanças de modo

### Inbox
- Filtros `ai_queue` / `human_queue` corretos (baseados em `ai_mode`)
- Agent sovereignty policy implementada (auto-takeover, banner autopilot)
- AI badges no `ConversationListItem`

### Widget Portal
- `AssistantWidget` + `useClientAssistant` criados e integrados no `ClientPortal`

---

## ⚠️ PROBLEMA 1 (CRÍTICO): Deploy do `process-chat-flow` pode não ter sido efetivado

**Evidência**: O log mais recente disponível ainda mostra `ReferenceError: saqueIntentMatch is not defined` (timestamp `23:34:33Z`). Embora o código-fonte esteja correto (variáveis declaradas nas linhas 2593-2597), o erro indica que a versão deployada pode ser a anterior ao fix.

**Ação**: Redeployar `process-chat-flow` e confirmar nos logs que o erro desapareceu.

---

## ⚠️ PROBLEMA 2 (MÉDIO): 6 intents do contrato não estão mapeados no motor de fluxos

O `INTENT_EXIT_CONTRACT.md` define 11 paths, mas o código só implementa routing para 5:

| Intent | Regex de detecção | Mapeamento no `intentData` | Path assignment | Status |
|---|---|---|---|---|
| financeiro | ✅ `financialActionPattern` | ✅ | ✅ `path='financeiro'` | OK |
| cancelamento | ✅ `cancellationActionPattern` | ✅ | ✅ `path='cancelamento'` | OK |
| comercial | ✅ `commercialActionPattern` | ✅ | ✅ `path='comercial'` | OK |
| suporte | ✅ `supportIntentPattern` | ✅ | ✅ `path='suporte'` | OK |
| consultor | ✅ `consultorActionPattern` | ✅ | ✅ `path='consultor'` | OK |
| **saque** | ❌ Nenhuma regex | ❌ Não mapeado | ❌ Sem path | **MORTO** |
| **devolucao** | ❌ | ❌ | ❌ | **MORTO** |
| **pedidos** | ❌ | ❌ | ❌ | **MORTO** |
| **sistema** | ❌ | ❌ | ❌ | **MORTO** |
| **internacional** | ❌ | ❌ | ❌ | **MORTO** |
| **comercial_internacional** | ❌ | ❌ | ❌ | **MORTO** |

As variáveis `saqueIntentMatch`, `devolucaoIntentMatch`, etc. são declaradas como `false` mas **nunca recebem `true`**. Elas só existem no bloco de reset do greeting guard — são código morto.

**Impacto**: Se a IA retornar `[[FLOW_EXIT:saque]]`, o `intentData.ai_exit_intent` seria `'saque'`, mas o bloco de mapeamento (linhas 3409-3416) não reconhece esse valor. O intent cai no `findNextNode` com `path='default'` em vez do path correto.

**Ação**: Para cada intent faltante:
1. Adicionar regex de detecção (ou mapear via `intentData`)
2. Adicionar `else if (intent === 'saque') { saqueIntentMatch = true; }` no bloco de intentData
3. Adicionar `else if (saqueIntentMatch) { path = 'saque'; }` no bloco de path assignment
4. Incluir na condição de exit (linha 3441)

---

## ⚠️ PROBLEMA 3 (MENOR): `findNextNode` fallback hierárquico pode mascarar paths faltantes

Quando um path como `'saque'` não tem edge dedicada, o `findNextNode` faz fallback: `path → ai_exit → default → any`. Isso significa que intents não mapeados acabam no `default`, o que pode ser aceitável se o fluxo visual não tem saídas dedicadas para saque/devolução/etc.

**Decisão necessária**: Se o Master Flow atual não usa esses 6 paths extras (apenas usa os 5 principais + condition_v2 para roteamento via `ai_exit_intent`), o código morto não causa bug — apenas poluição. Se no futuro forem adicionados handles no canvas, o mapeamento precisará existir.

---

## Plano de Correção

### Fase 1 — Garantir deploy (URGENTE)
- Redeployar `process-chat-flow` para garantir que o fix das variáveis está em produção

### Fase 2 — Completar mapeamento de intents
No `process-chat-flow/index.ts`:
1. No bloco `intentData.ai_exit_intent` (linhas 3409-3416): adicionar mapeamento para `saque`, `devolucao`, `pedidos`, `sistema`, `internacional`, `comercial_internacional`
2. No bloco de path assignment (linhas 3494-3521): adicionar paths para os 6 novos intents
3. Na condição de exit (linha 3441): incluir os 6 novos `*IntentMatch` flags
4. Nos auto-save de intent (linhas 3419-3438): adicionar correspondentes

### Fase 3 — Limpeza
- Se os 6 intents extras não serão usados no Master Flow atual, considerar removê-los para simplificar (menos manutenção)

