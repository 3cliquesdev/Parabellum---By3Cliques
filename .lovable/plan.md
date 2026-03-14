

# Diagnóstico: Por que NÃO aparece mensagem de horário comercial

## Evidências dos dados

**1. Todos os handoffs das últimas 12h vêm dos Chat Flows, NÃO do ai-autopilot-chat:**

Consultei `ai_events` e todos os 10+ handoffs recentes têm `reason: "flow_transfer_node_msg_chain"` — são transferências executadas pelo **motor de Chat Flows** (`process-chat-flow`), não pelo autopilot.

**2. Zero mensagens de horário comercial enviadas:**

Busquei em `messages` por conteúdos como "atendimento humano funciona", "horário comercial", "posso continuar tentando" — resultado: **zero registros**. Nenhuma mensagem after-hours foi enviada nas últimas 24h.

**3. Zero metadados after-hours nas conversas:**

Busquei `customer_metadata` com `after_hours` em todas as conversas — resultado: **zero**. O bloco L8423-8527 do `ai-autopilot-chat` **nunca foi executado**.

**4. O template exists no banco mas nunca é usado:**

```
business_messages_config:
  message_key: after_hours_handoff
  message_template: "Nosso atendimento humano funciona {schedule}..."
  after_hours_tag_id: NULL (nunca configurado)
```

## Causa raiz

O código de "fora do horário" (L8423-8527 no `ai-autopilot-chat`) só é executado quando a **IA do autopilot** decide chamar a tool `transfer_to_human`. Porém, as transferências estão sendo feitas pelos **nós de Transfer do Chat Flow** (`process-chat-flow`), que:

- Chamam `transition-conversation-state` diretamente
- **NÃO verificam horário comercial**
- **NÃO enviam mensagem de horário**
- **NÃO aplicam tag**

```text
Fluxo atual (Chat Flow):
  Cliente → Chat Flow → Transfer Node → transition-conversation-state → waiting_human
  (SEM verificação de horário, SEM mensagem, SEM tag)

Fluxo esperado:
  Cliente → Chat Flow → Transfer Node → VERIFICA HORÁRIO →
    Se fora: envia mensagem + aplica tag + fecha conversa
    Se dentro: transfere normalmente
```

## Plano de correção

### Arquivo: `supabase/functions/process-chat-flow/index.ts`

Em **todos os pontos** onde `nextNode.type === 'transfer'` e o `ai_mode` resultante é `waiting_human`, adicionar verificação de horário comercial **antes** de executar a transferência.

**Lógica a inserir** (antes de chamar `transition-conversation-state`):

```typescript
// Verificar horário comercial antes de transferir para humano
if (chainTransferAiMode === 'waiting_human') {
  const bhInfo = await getBusinessHoursInfo(supabaseClient);
  if (!bhInfo.within_hours) {
    // 1. Enviar mensagem de horário comercial
    const { data: msgRow } = await supabaseClient
      .from('business_messages_config')
      .select('message_template, after_hours_tag_id')
      .eq('message_key', 'after_hours_handoff')
      .maybeSingle();
    
    const afterHoursMsg = (msgRow?.message_template || 'Nosso atendimento funciona {schedule}...')
      .replace(/\{schedule\}/g, bhInfo.schedule_summary)
      .replace(/\{next_open\}/g, bhInfo.next_open_text);
    
    // 2. Enviar mensagem ao cliente
    await supabaseClient.from('messages').insert({...});
    
    // 3. Aplicar tag configurada
    if (msgRow?.after_hours_tag_id) {
      await supabaseClient.from('conversation_tags').upsert({...});
    }
    
    // 4. Fechar conversa
    await supabaseClient.from('conversations').update({
      status: 'closed', auto_closed: true, 
      closed_reason: 'after_hours_handoff'
    });
    
    // 5. NÃO chamar transition-conversation-state
    return; // Sair sem transferir
  }
}
```

### Pontos de inserção identificados (há ~10 locais de transfer no arquivo):

Para evitar duplicação, a melhor abordagem é criar uma **função helper** `handleTransferWithBusinessHours()` que encapsula a lógica e é chamada em todos os pontos de transfer do Chat Flow.

### Resumo das alterações:

1. **`process-chat-flow/index.ts`**: Criar helper `handleTransferWithBusinessHours()` e usá-lo em todos os pontos de transfer node
2. **Reutiliza** `getBusinessHoursInfo` (já importado no arquivo)
3. **Reutiliza** `business_messages_config` com `after_hours_tag_id` (já no banco)
4. Nenhuma alteração de banco necessária

