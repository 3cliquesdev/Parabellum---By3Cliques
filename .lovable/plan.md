
# Plano: Correção de Duplicação de Mensagens - Unificação de Pipeline

## Diagnóstico Confirmado

### Screenshot Analisado
O usuário vê mensagens duplicadas como "Assistente Virtual" e "Atendente" para o mesmo conteúdo "Obrigado! Suas informações foram registradas."

### Dados do Banco (Prova)

| ID | Conteúdo | is_ai_generated | channel | metadata |
|----|----------|-----------------|---------|----------|
| 67ea36f6 | Obrigado! Suas... | **FALSE** | web_chat | send-meta-whatsapp |
| 85bff5ec | Obrigado! Suas... | **TRUE** | whatsapp | null |

A mesma mensagem foi inserida **2x** com atributos diferentes!

### Causa Raiz Identificada

**Dois pipelines paralelos processam a mesma mensagem:**

```text
Cliente envia WhatsApp
        |
        v
meta-whatsapp-webhook → handle-whatsapp-event
        |
        v
insere mensagem do cliente no banco
        |
        +----------------------+
        |                      |
        v                      v
CAMINHO 1:               CAMINHO 2:
Database Trigger         handle-whatsapp-event
        |                      |
        v                      v
message-listener         ai-autopilot-chat (linha 1142)
        |                      |
        v                      v
process-chat-flow        IA gera resposta
        |                      |
        v                      v
INSERE resposta          INSERE resposta
is_ai_generated:false    is_ai_generated:true
        |                      |
        |                      v
        |                send-meta-whatsapp
        |                      |
        |                      v
        |                INSERE outra copia
        |                (sem skip_db_save!)
        +----------------------+
                |
                v
        2-3 mensagens iguais!
```

### Por que aparece "Assistente Virtual" vs "Atendente"?

No `MessageBubble.tsx` (linha 129):
```typescript
{isAI ? "Assistente Virtual" : (sender?.full_name || "Atendente")}
```

- `is_ai_generated: true` → "Assistente Virtual"
- `is_ai_generated: false` → "Atendente"

---

## Solucao Proposta

### Principio: "Um Unico Responsavel"

Para mensagens WhatsApp:
- **handle-whatsapp-event** processa tudo (fluxo + IA)
- **message-listener** NAO processa mensagens WhatsApp (ja foram processadas)

Para mensagens Web Chat:
- **message-listener** continua processando normalmente

---

## Alteracoes Detalhadas

### 1. message-listener — Ignorar mensagens ja processadas pelo WhatsApp

**Arquivo**: `supabase/functions/message-listener/index.ts`

**Local**: Apos verificar sender_type (linha 31)

**Logica**: Se a mensagem veio do canal WhatsApp, o `handle-whatsapp-event` ja processou. O `message-listener` deve ignorar para evitar duplicacao.

```typescript
// Apos linha 38 (busca da conversa)

// ============================================================
// 🚫 ANTI-DUPLICACAO: Se canal WhatsApp, ja foi processado
// handle-whatsapp-event chama ai-autopilot-chat diretamente
// ============================================================
if (conversation?.channel === 'whatsapp') {
  console.log('[message-listener] ⏭️ Canal WhatsApp - ja processado por handle-whatsapp-event');
  return new Response(JSON.stringify({ 
    status: 'skipped', 
    reason: 'whatsapp_handled_by_webhook',
    message: 'WhatsApp messages are processed by handle-whatsapp-event'
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}
```

### 2. handle-whatsapp-event — Chamar process-chat-flow ANTES da IA

**Arquivo**: `supabase/functions/handle-whatsapp-event/index.ts`

**Local**: Antes da linha 1136 (bloco de trigger da IA)

**Logica**: Verificar se existe fluxo ativo antes de chamar a IA. Se o fluxo retornar resposta, enviar e NAO chamar a IA.

```typescript
// Adicionar ANTES da linha 1136 (bloco "Se ai_mode = 'autopilot'")

// ============================================================
// 🔄 PROCESS-CHAT-FLOW PRIMEIRO (Anti-Duplicacao)
// Se fluxo retornar resposta, nao chamar IA
// ============================================================
console.log('[handle-whatsapp-event] 🔄 Verificando fluxo de chat...');

let flowHandled = false;
try {
  const { data: flowResult, error: flowError } = await supabase.functions.invoke('process-chat-flow', {
    body: {
      conversationId: conversationId,
      userMessage: messageText
    }
  });

  if (!flowError && flowResult && !flowResult.useAI && flowResult.response) {
    console.log('[handle-whatsapp-event] 📋 Fluxo retornou resposta:', flowResult.response?.slice(0, 50));
    flowHandled = true;

    // Inserir resposta do fluxo no banco
    const { data: savedFlowMsg } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      content: flowResult.response,
      sender_type: 'user',
      is_ai_generated: true, // Marcar como automatico para UI mostrar "Assistente Virtual"
      channel: 'whatsapp'
    }).select('id').single();

    // Enviar para WhatsApp com skip_db_save (ja salvamos acima)
    if (savedFlowMsg?.id) {
      await supabase.functions.invoke('send-meta-whatsapp', {
        body: {
          instance_id: instance.id,
          phone_number: phoneForDatabase,
          message: flowResult.response,
          conversation_id: conversationId,
          skip_db_save: true // 🆕 CRITICO: Evita duplicacao
        }
      });
      console.log('[handle-whatsapp-event] ✅ Resposta do fluxo enviada via WhatsApp');
    }
  }
} catch (flowError) {
  console.error('[handle-whatsapp-event] ❌ Erro ao processar fluxo:', flowError);
}

// ============================================================
// 🤖 IA APENAS SE FLUXO NAO TRATOU
// ============================================================
if (flowHandled) {
  console.log('[handle-whatsapp-event] ⏭️ Fluxo ja tratou - pulando IA');
  return new Response(JSON.stringify({
    success: true,
    message_saved: true,
    flow_handled: true
  }), { headers: corsHeaders });
}
```

### 3. ai-autopilot-chat — Adicionar skip_db_save ao enviar WhatsApp

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

**Local**: Linha 7329 (chamada send-meta-whatsapp)

**Alteracao**: Ja salva mensagem antes (linha 7193), entao deve usar `skip_db_save: true`

```typescript
// Linha 7329-7336
const { data: metaResponse, error: metaError } = await supabaseClient.functions.invoke('send-meta-whatsapp', {
  body: {
    instance_id: whatsappInstance.id,
    phone_number: contact.phone?.replace(/\D/g, ''),
    message: assistantMessage,
    conversation_id: conversationId,
    skip_db_save: true // 🆕 CRITICO: Ja salvamos na linha 7193
  },
});
```

### 4. sendWhatsAppMessage helper — Adicionar skip_db_save

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

**Local**: Linhas 518-524 (funcao helper)

```typescript
const { data, error } = await supabaseClient.functions.invoke('send-meta-whatsapp', {
  body: {
    instance_id: whatsappResult.instance.id,
    phone_number: phoneNumber?.replace(/\D/g, ''),
    message,
    conversation_id: conversationId,
    skip_db_save: true // 🆕 CRITICO: Quem chama ja salvou
  }
});
```

---

## Arquivos a Modificar

| Arquivo | Acao | Descricao |
|---------|------|-----------|
| `message-listener/index.ts` | Modificar | Ignorar canal WhatsApp |
| `handle-whatsapp-event/index.ts` | Modificar | Chamar process-chat-flow antes da IA |
| `ai-autopilot-chat/index.ts` | Modificar | Adicionar skip_db_save em todas chamadas WhatsApp |

---

## Secao Tecnica

### Novo Fluxo (Apos Correcao)

```text
Cliente envia WhatsApp
        |
        v
meta-whatsapp-webhook → handle-whatsapp-event
        |
        v
insere mensagem do cliente no banco
        |
        v
Verifica process-chat-flow
        |
   +----+----+
   |         |
   v         v
FLUXO      SEM FLUXO
ATIVO      ATIVO
   |         |
   v         v
Envia      Chama IA
resposta   (ai-autopilot)
do fluxo       |
   |         v
   v      IA responde
WhatsApp     |
(skip_db)    v
   |      WhatsApp
   |      (skip_db)
   +----+----+
        |
        v
   UMA mensagem
   no banco

Database Trigger → message-listener
        |
        v
Canal = WhatsApp?
   SIM → IGNORA (ja processado)
   NAO → Processa normalmente
```

### Regras de skip_db_save

| Origem | Salva no banco? | Envia WhatsApp com skip_db_save? |
|--------|-----------------|----------------------------------|
| handle-whatsapp-event (fluxo) | SIM (antes de enviar) | SIM |
| ai-autopilot-chat | SIM (linha 7193) | SIM |
| message-listener | SIM | N/A (nao envia WhatsApp) |
| Frontend (sendInstant) | SIM (otimista) | SIM |

---

## Criterios de Aceitacao

| Teste | Resultado Esperado |
|-------|-------------------|
| Mensagem WhatsApp com fluxo ativo | 1 mensagem no banco, 1 no WhatsApp |
| Mensagem WhatsApp sem fluxo (IA) | 1 mensagem no banco, 1 no WhatsApp |
| Mensagem Web Chat | Processada por message-listener normalmente |
| message-listener recebe WhatsApp | Ignora com log "whatsapp_handled_by_webhook" |
| UI mostra resposta | Apenas "Assistente Virtual" (nao duplicado) |

---

## Impacto

| Componente | Antes | Depois |
|------------|-------|--------|
| Mensagens WhatsApp | 2-3 copias | 1 copia |
| message-listener | Processa tudo | Ignora WhatsApp |
| handle-whatsapp-event | Nao chamava fluxo | Chama fluxo primeiro |
| send-meta-whatsapp | Salvava duplicado | skip_db_save = true |

---

## Ordem de Implementacao

1. **ai-autopilot-chat**: Adicionar `skip_db_save: true` nas chamadas WhatsApp
2. **message-listener**: Adicionar verificacao de canal WhatsApp
3. **handle-whatsapp-event**: Adicionar chamada ao process-chat-flow
4. **Deploy**: Publicar todas as edge functions
5. **Validacao**: Testar envio WhatsApp e verificar 1 mensagem no banco

---

## Nota sobre a UI

Apos a correcao, mensagens automaticas devem aparecer APENAS como "Assistente Virtual" porque todas terao `is_ai_generated: true`.

A label "Atendente" sera usada apenas para mensagens enviadas manualmente por humanos (agentes).
