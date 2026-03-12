

# Auditoria Final: Sistema de Encerramento de Conversas

## Status Geral

Após revisão completa dos 4 arquivos envolvidos, encontrei **3 problemas restantes** — 1 crítico e 2 menores.

---

## Problemas Encontrados

### CRÍTICO: Evolution API sem bypass de `awaiting_close_confirmation`

**Arquivo:** `handle-whatsapp-event/index.ts` (L1199)

O webhook Meta (`meta-whatsapp-webhook`) tem bypass implementado nas linhas 755-789: quando `awaiting_close_confirmation=true` e `skipAutoResponse=true`, ele redireciona para `ai-autopilot-chat` para processar a confirmação do cliente.

**O webhook Evolution API (`handle-whatsapp-event`) NÃO tem esse bypass.** Se uma conversa via Evolution API estiver em `waiting_human` com `awaiting_close_confirmation=true`, o cliente responde "sim" e a mensagem é **ignorada** — porque `conversationAIMode` será `waiting_human` e o código nunca chega ao bloco de AI (L1199 exige `autopilot`).

**Fix:** Adicionar guard antes do check de `conversationAIMode === 'autopilot'` (L1199) que detecta `awaiting_close_confirmation=true` no metadata e faz bypass direto para `ai-autopilot-chat`, idêntico ao que o Meta webhook faz.

---

### MENOR 1: Tool description com "cliente_agradeceu" como exemplo de reason

**Arquivo:** `ai-autopilot-chat/index.ts` (L6871)

A tool definition do `close_conversation` ainda tem:
```
reason: { description: '...ex: "assunto_resolvido", "cliente_agradeceu"' }
```

O exemplo `"cliente_agradeceu"` reforça o modelo a chamar a tool quando o cliente agradece, contradizendo o prompt restritivo da L6690. Deve ser removido.

**Fix:** Mudar para `'...ex: "assunto_resolvido", "duvida_esclarecida"'`

---

### MENOR 2: Stage 3.5 não envia via WhatsApp para canal `whatsapp_meta`

**Arquivo:** `auto-close-conversations/index.ts` (L688)

O check é `conv.channel === 'whatsapp'` e a função `sendWhatsAppMessages` já lida com ambos providers (Meta e Evolution). **Isso está OK** — conversas Meta WhatsApp também usam `channel: 'whatsapp'`. Sem problema real aqui.

---

## Itens Confirmados OK

| Item | Status |
|---|---|
| `yesKeywords` regex restritivo | OK — sem "obrigado", "valeu" |
| Guard de `?` na confirmação | OK — L2187-2191 |
| `noKeywords` cobertura | OK |
| Prompt `close_conversation` (L6690) | OK — já corrigido |
| Tool handler 2 etapas (L8194-8221) | OK |
| Stage 3.5 verifica último sender | OK |
| Stage 3.5 limpa `close_reason` do metadata | OK |
| Stage 3.5 envio WhatsApp | OK |
| Meta webhook bypass (L755-789) | OK |
| Kill Switch / Shadow Mode guards | OK |
| Tags obrigatórias guard | OK |

---

## Plano de Correção

| # | Arquivo | Mudança |
|---|---|---|
| 1 | `handle-whatsapp-event/index.ts` (~L1197) | Adicionar bypass `awaiting_close_confirmation` antes do check de autopilot — redirecionar para `ai-autopilot-chat` |
| 2 | `ai-autopilot-chat/index.ts` (L6871) | Trocar `"cliente_agradeceu"` por `"duvida_esclarecida"` no exemplo de reason |

Após essas 2 correções, o sistema de encerramento estará 100% consistente entre ambos webhooks (Meta e Evolution).

