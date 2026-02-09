
# Redirecionar cliente recorrente direto para o consultor

## Problema

Quando um cliente que ja passou pelo fluxo e foi atendido por um consultor volta a mandar mensagem:

1. A conversa anterior esta `closed`
2. Uma nova conversa e criada com `ai_mode: autopilot` e `assigned_to: null`
3. O fluxo roda de novo do zero - o cliente precisa refazer tudo

## Solucao

Na criacao de novas conversas no `meta-whatsapp-webhook`, verificar se o contato ja tem `consultant_id` definido. Se tiver, criar a conversa ja atribuida ao consultor:

- `assigned_to = contact.consultant_id`
- `ai_mode = 'copilot'`

A protecao existente no `process-chat-flow` (linha 317) ja bloqueia o fluxo quando `ai_mode = copilot`, entao o cliente vai direto para o consultor sem passar pelo fluxo novamente.

## Alteracao

### `supabase/functions/meta-whatsapp-webhook/index.ts` (~linha 469-485)

Antes de criar a nova conversa, verificar o `consultant_id` do contato:

```text
Conversa nao encontrada (nova conversa)
  → Buscar consultant_id do contato
  → Se tem consultor:
      criar conversa com assigned_to = consultant_id, ai_mode = 'copilot'
  → Se nao tem consultor:
      criar conversa normal com ai_mode = 'autopilot' (comportamento atual)
```

Trecho conceitual:

```typescript
// Verificar se contato tem consultor (cliente recorrente)
const { data: contactData } = await supabase
  .from('contacts')
  .select('consultant_id')
  .eq('id', contact.id)
  .maybeSingle();

const hasConsultant = !!contactData?.consultant_id;

const { data: newConv } = await supabase
  .from("conversations")
  .insert({
    contact_id: contact.id,
    channel: "whatsapp",
    status: "open",
    ai_mode: hasConsultant ? "copilot" : "autopilot",
    assigned_to: hasConsultant ? contactData.consultant_id : null,
    whatsapp_provider: "meta",
    whatsapp_meta_instance_id: instance.id,
  })
  .select(...)
  .single();

if (hasConsultant) {
  console.log("[meta-whatsapp-webhook] 👤 Cliente recorrente → direto para consultor:", contactData.consultant_id);
}
```

## Fluxo esperado

```text
Cliente recorrente (ja tem consultant_id):
  Msg → nova conversa com assigned_to=consultor, ai_mode=copilot
    → process-chat-flow detecta copilot → skipAutoResponse
    → Conversa aparece na caixa do consultor

Cliente novo (sem consultant_id):
  Msg → nova conversa com ai_mode=autopilot
    → Fluxo roda normalmente (comportamento atual)
```

## Impacto

| Item | Status |
|------|--------|
| Regressao | Zero - apenas adiciona checagem na criacao de conversa |
| Clientes novos | Sem alteracao - fluxo roda normal |
| Clientes recorrentes | Direto para o consultor |
| process-chat-flow | Sem alteracao - protecao existente ja cuida |
| Performance | 1 query adicional apenas ao criar nova conversa |
