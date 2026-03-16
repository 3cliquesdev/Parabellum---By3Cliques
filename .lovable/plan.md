

# Configuração: Fechar ou Manter Aberta Fora do Horário

## Situação Atual

Existem **2 caminhos** que tratam handoff fora do horário, com comportamentos diferentes:

| Caminho | Arquivo | Comportamento |
|---------|---------|---------------|
| Autopilot (tool `request_human_agent`) | `ai-autopilot-chat/index.ts` L8470 | **Mantém aberta** — salva metadata, aplica tag `pendente_retorno`, NÃO fecha |
| Webhook (sem agentes online) | `meta-whatsapp-webhook/index.ts` L910 | **Fecha** — `status: "closed"`, `close_reason: "after_hours_handoff"` |

O usuário quer **autonomia total** para escolher o comportamento via UI.

## Plano

### 1. Nova configuração em `system_configurations`

Chave: `after_hours_keep_open` — valores `"true"` (manter aberta na fila) ou `"false"` (fechar conversa). Default: `"true"`.

### 2. Toggle na UI — Seção "Mensagens de Fora do Horário" (`SLASettings.tsx`)

Adicionar um Switch dentro da seção `BusinessMessagesSection`, logo abaixo do seletor de tag do `after_hours_handoff`:

- Label: **"Manter conversa aberta fora do horário"**
- Descrição: "Se ativo, a conversa permanece na fila e será distribuída quando o expediente começar. Se desativado, a conversa é encerrada."
- Usa `system_configurations` com `key = "after_hours_keep_open"`
- Mesmo padrão já usado em `useConversationCloseSettings` (upsert com `onConflict: "key"`)

### 3. `meta-whatsapp-webhook/index.ts` — Respeitar configuração

No bloco `!bhInfo.within_hours` (L879-923):
- Buscar `after_hours_keep_open` de `system_configurations`
- Se `"true"`: enviar a mensagem configurada, aplicar tag, mas **NÃO fechar** — manter `status: "open"` com `ai_mode: "autopilot"` e salvar metadata de pending
- Se `"false"`: comportamento atual (fechar)

### 4. `ai-autopilot-chat/index.ts` — Respeitar configuração (inverso)

No bloco de after_hours da tool `request_human_agent` (L8519-8532):
- Buscar `after_hours_keep_open`
- Se `"false"`: fechar a conversa (`status: "closed"`, `close_reason: "after_hours_handoff"`)
- Se `"true"`: comportamento atual (manter aberta)

Isso unifica os dois caminhos com a mesma configuração.

### 5. Evolution API (`handle-whatsapp-event`)

Não tem lógica de after_hours no webhook — passa pelo autopilot que já será corrigido no passo 4.

## Resumo de Alterações

| # | Tipo | O quê |
|---|------|-------|
| 1 | UI | Toggle "Manter aberta fora do horário" na seção de mensagens do SLA |
| 2 | Edge Function | `meta-whatsapp-webhook` — condicional close vs keep open |
| 3 | Edge Function | `ai-autopilot-chat` — condicional close vs keep open |

