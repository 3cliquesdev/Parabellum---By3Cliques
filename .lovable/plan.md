

# Plano: Ajustes finais nos 5 arquivos

## O que já está implementado vs. o que falta

| Item | Status | Ajuste necessário |
|------|--------|-------------------|
| `_shared/business-hours.ts` | ✅ Existe | Adicionar `today_open_time`, `today_close_time` ao retorno |
| `buildVariablesContext` | ✅ Injeta business + SLA | Adicionar `business_is_holiday`, `business_holiday_name`, `business_today_open`, `business_today_close` |
| `variableCatalog.ts` | ✅ Tem BUSINESS_VARS | Adicionar as 4 variáveis extras |
| `add_tag` no engine | ✅ Funciona para contact | Adicionar suporte a `scope: 'conversation'` (tabela `conversation_tags` já existe) |
| Editor UI para add_tag | ❌ Falta | Adicionar painel de configuração: seletor de tag + seletor de scope |
| Refatoração distribute/whatsapp | ✅ Já usam helper | Nenhum ajuste |

## Alterações

### 1. `_shared/business-hours.ts`
- Adicionar `today_open_time` e `today_close_time` ao `BusinessHoursResult`
- Preencher a partir do `todayConfig.start_time` / `end_time` (ou `null` se não é dia útil/feriado)

### 2. `process-chat-flow/index.ts` — `buildVariablesContext`
- Injetar variáveis extras do helper:
  - `business_is_holiday` (boolean)
  - `business_holiday_name` (string)
  - `business_today_open` (string, ex: "09:00")
  - `business_today_close` (string, ex: "18:00")

### 3. `process-chat-flow/index.ts` — `end_action === 'add_tag'` com scope
- Ler `scope` de `nextNode.data.action_data?.tag_scope` (default: `'contact'`)
- Se `scope === 'conversation'`: inserir em `conversation_tags` (conversation_id, tag_id) com `ON CONFLICT DO NOTHING`
- Se `scope === 'contact'`: manter lógica atual (`contact_tags`)

### 4. `variableCatalog.ts`
- Adicionar ao grupo `BUSINESS_VARS`:
  - `business_is_holiday` — "É Feriado"
  - `business_holiday_name` — "Nome do Feriado"
  - `business_today_open` — "Abertura Hoje"
  - `business_today_close` — "Fechamento Hoje"

### 5. `ChatFlowEditor.tsx` — Painel add_tag
- Quando `end_action === 'add_tag'`, renderizar:
  - Select de scope: "Conversa" / "Contato"
  - Select de tag (query em `tags` table)
  - Mostrar tag selecionada

### Arquivos impactados (5)
1. `supabase/functions/_shared/business-hours.ts`
2. `supabase/functions/process-chat-flow/index.ts`
3. `src/components/chat-flows/variableCatalog.ts`
4. `src/components/chat-flows/ChatFlowEditor.tsx`
5. `src/components/chat-flows/nodes/EndNode.tsx` (mostrar scope no badge)

