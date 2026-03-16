

# Bug: "Reenviar" falha com "Erro desconhecido"

## Problema Identificado

O `retrySend` no `useSendMessageInstant.tsx` (linhas 425-480) tem **dois bugs graves**:

1. **Tenta inserir com o mesmo UUID** -- a mensagem original ja existe no banco (foi persistida com `status: 'failed'`). O `INSERT` com mesmo `id` causa violacao de unique constraint, gerando o "Erro desconhecido".

2. **Nao invoca a Edge Function do WhatsApp** -- apenas faz `INSERT` no banco, sem chamar `send-meta-whatsapp` ou `send-whatsapp-message`. Mesmo que o insert funcionasse, a mensagem nunca seria entregue via WhatsApp.

## Correcao

Reescrever `retrySend` para:

1. **Buscar a mensagem falhada do banco** (nao do cache) com seu conteudo, canal e conversation_id
2. **Buscar o whatsappConfig** da conversa (phone_number, provider, instance_id)
3. **Invocar a Edge Function** (`send-meta-whatsapp` ou `send-whatsapp-message`) usando `invokeWithRetry`
4. **Atualizar o status** da mensagem existente de `failed` para `sent` via `UPDATE` (nao INSERT)

### Arquivo: `src/hooks/useSendMessageInstant.tsx`

Substituir linhas 425-480 com logica que:
- Faz `SELECT` da mensagem falhada do banco
- Faz `SELECT` da conversa para obter `whatsapp_phone_number`, `channel`, `instance_id`
- Chama `invokeWithRetry` com a Edge Function correta
- Faz `UPDATE messages SET status = 'sent', external_id = ... WHERE id = messageId`

### Tecnico

```text
retrySend(messageId, conversationId)
  1. SELECT message FROM messages WHERE id = messageId
  2. SELECT conversation (phone, instance_id, channel)
  3. invokeWithRetry('send-meta-whatsapp' | 'send-whatsapp-message', payload)
  4. UPDATE messages SET status = 'sent' WHERE id = messageId
  5. Atualizar cache
```

Nenhum arquivo novo. Apenas correcao do `retrySend` em `src/hooks/useSendMessageInstant.tsx`.

