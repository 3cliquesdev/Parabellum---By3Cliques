

# Fix: Saudação Proativa Desliga o Autopilot

## Problema
A saudação proativa é enviada com sucesso ao WhatsApp, mas `send-meta-whatsapp` interpreta como mensagem humana (por faltar `is_bot_message: true`) e muda `ai_mode` de `autopilot` para `copilot`. Resultado: a IA não responde mais nenhuma mensagem do cliente após a saudação.

## Causa Raiz
Linha 7257-7264 de `ai-autopilot-chat/index.ts` — falta `is_bot_message: true` no body da invocação:

```text
ATUAL (incompleto):
  body: {
    instance_id, phone_number, message, conversation_id,
    skip_db_save: true
  }

CORRETO (como nas outras ~20 chamadas):
  body: {
    instance_id, phone_number, message, conversation_id,
    skip_db_save: true,
    is_bot_message: true    ← FALTAVA
  }
```

## Correção
Em `supabase/functions/ai-autopilot-chat/index.ts`, linha 7263, adicionar `is_bot_message: true` ao body do `send-meta-whatsapp` na saudação proativa.

## Deploy
Redeploy da Edge Function `ai-autopilot-chat`.

