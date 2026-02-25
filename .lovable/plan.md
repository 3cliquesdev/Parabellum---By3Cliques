

# Plano: Entregar Mensagens do Fluxo Manual via WhatsApp

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico

O problema está dividido em duas partes:

### Parte 1 — Manual Trigger não entrega mensagens
Quando o `TestModeDropdown` inicia um fluxo manualmente:
1. Chama `process-chat-flow` com `manualTrigger: true`
2. A edge function retorna a resposta do fluxo (mensagem + opções) no JSON
3. **O frontend ignora o `data` retornado** — só verifica `error`
4. **A edge function não salva no banco nem envia para WhatsApp**
5. Resultado: o fluxo inicia, o estado é criado, mas nenhuma mensagem chega ao cliente

### Parte 2 — Fallback da IA só salva no banco
A mensagem "Desculpe, estou com dificuldades técnicas" (linha 7375 do `ai-autopilot-chat`) é inserida na tabela `messages` mas **nunca invoca `send-meta-whatsapp`** para entregá-la no WhatsApp do cliente.

## Solução

### 1. `process-chat-flow/index.ts` — Entregar mensagem no manual trigger

Após criar o estado do fluxo (linha 687), antes de retornar, o motor deve:
- Buscar os dados da conversa (channel, contact, whatsapp instance)
- Se o canal for WhatsApp: salvar a mensagem na tabela `messages` E invocar `send-meta-whatsapp`
- Se for web_chat: apenas salvar na tabela `messages` (o realtime cuida da entrega)

Trecho a adicionar após linha 687, antes dos `if (contentNode.type === ...)`:

```typescript
// === DELIVERY: Entregar mensagem ao cliente no manual trigger ===
const { data: convForDelivery } = await supabaseClient
  .from('conversations')
  .select('channel, contact_id, whatsapp_meta_instance_id')
  .eq('id', conversationId)
  .maybeSingle();

let deliveryPhone: string | null = null;
if (convForDelivery?.contact_id) {
  const { data: contactData } = await supabaseClient
    .from('contacts')
    .select('phone, whatsapp_id')
    .eq('id', convForDelivery.contact_id)
    .maybeSingle();
  deliveryPhone = contactData?.whatsapp_id || contactData?.phone;
}

// Montar mensagem formatada
const deliveryMessage = /* construir baseado no tipo do nó */;

if (deliveryMessage) {
  // 1. Salvar na tabela messages
  await supabaseClient.from('messages').insert({...});
  
  // 2. Se WhatsApp, enviar via send-meta-whatsapp
  if (convForDelivery?.channel === 'whatsapp' && convForDelivery?.whatsapp_meta_instance_id) {
    await supabaseClient.functions.invoke('send-meta-whatsapp', {...});
  }
}
```

### 2. `ai-autopilot-chat/index.ts` — Entregar fallback via WhatsApp

Na seção de fallback (linhas 7370-7382), após inserir a mensagem no banco, adicionar envio via WhatsApp usando a mesma lógica de delivery que já existe no bloco principal (linhas 7086-7150).

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/process-chat-flow/index.ts` | Adicionar delivery (DB + WhatsApp) no bloco de manual trigger, antes dos returns |
| `supabase/functions/ai-autopilot-chat/index.ts` | Adicionar `send-meta-whatsapp` no bloco de fallback (linhas 7370-7382) |

### Impacto e segurança

| Regra | Status |
|---|---|
| Regressão zero | Sim — só adiciona delivery onde faltava, não altera fluxo existente |
| Kill Switch | Preservado — manual trigger já valida kill switch + test mode |
| Anti-duplicação | `skip_db_save: true` no WhatsApp, mensagem já salva manualmente |
| Pipeline existente | Preservado — webhook continua funcionando normalmente para mensagens recebidas |
| CSAT guard | Não afetado |

