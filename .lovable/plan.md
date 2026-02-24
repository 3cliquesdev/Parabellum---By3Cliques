

# Rastreamento de Entrega dos Templates de Reengajamento

## Problema Atual

Quando um template de reengajamento e enviado:
1. A edge function `send-meta-whatsapp` envia o template e recebe o `wamid` (WhatsApp Message ID) de volta do Meta
2. O dialog insere apenas uma mensagem de sistema generica (`📋 Template enviado: ...`) **sem** o `provider_message_id`
3. Quando o Meta envia callbacks de status (`sent`, `delivered`, `read`), o webhook busca por `provider_message_id` mas nao encontra nenhuma mensagem correspondente
4. Resultado: nenhum rastreamento de entrega (sem ticks de confirmacao)

## Solucao

A edge function `send-meta-whatsapp` ja tem um "legacy path" que salva a mensagem automaticamente com `provider_message_id` quando recebe `conversation_id` no body. Basta passar esse campo (e o `sender_id`) na chamada do dialog.

## Mudancas

### Arquivo: `src/components/inbox/ReengageTemplateDialog.tsx`

**1. Adicionar `conversation_id` e `sender_id` no body da chamada da edge function (linha 86-96)**

```typescript
const { data, error } = await supabase.functions.invoke("send-meta-whatsapp", {
  body: {
    phone_number: conversation.contacts.phone,
    instance_id: instanceId,
    conversation_id: conversation.id,  // NOVO
    sender_id: user?.id,               // NOVO
    template: {
      name: selectedTemplate.name,
      language_code: selectedTemplate.language_code,
      components: components.length > 0 ? components : undefined,
    },
  },
});
```

A edge function ja faz o INSERT com `provider_message_id = wamid` quando `conversation_id` esta presente (legacy path, linha 430).

**2. Remover o insert manual da mensagem de sistema (linhas 127-136)**

O insert manual atual cria uma mensagem `sender_type: "system"` sem `provider_message_id`. Com a mudanca acima, a edge function ja cria a mensagem real (tipo `user`, outbound) com o `wamid`. O insert duplicado deve ser removido para evitar duas mensagens.

## Fluxo Corrigido

```
1. Dialog envia template com conversation_id + sender_id
2. Edge function envia para Meta, recebe wamid
3. Edge function salva mensagem com provider_message_id = wamid
4. Meta envia callback: sent -> delivered -> read
5. Webhook busca por provider_message_id, encontra a mensagem
6. Status atualizado: ticks aparecem no chat
```

## Zero Regressao

- Template continua sendo enviado normalmente via mesma edge function
- Apenas adiciona campos que a edge function ja suporta
- Kill Switch, Shadow Mode, CSAT guard: sem impacto
- Webhook de status nao muda - ja busca por `provider_message_id`
- Remove apenas o insert duplicado que nao tinha rastreamento

