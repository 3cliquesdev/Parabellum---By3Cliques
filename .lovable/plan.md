

## Plano de Correção: Bug 5 - Palavras Trocadas ao Enviar

### Problema Identificado

O atendente digita uma mensagem corretamente, vê ela no campo de texto, mas depois de enviar a mensagem que **chega no cliente** é diferente.

### Causa Raiz

**Condição de corrida no sistema de fila de mensagens (`message_queue`).**

Quando um atendente envia uma mensagem:

1. A mensagem vai para a fila (`message_queue`) com status `pending`
2. A função `send-whatsapp-message` imediatamente busca as **5 primeiras mensagens pendentes** da instância (ordenadas por prioridade e tempo)
3. **Se houver mensagens antigas pendentes ou que falharam** na frente da fila, elas são enviadas **antes** da mensagem atual
4. O cliente recebe a mensagem errada (a que estava na fila), enquanto o atendente vê a sua mensagem correta no chat

Trecho problemático em `supabase/functions/send-whatsapp-message/index.ts:165-173`:
```typescript
const { data: pendingMessages } = await supabase
  .from('message_queue')
  .select('*')
  .eq('status', 'pending')
  .eq('instance_id', body.instance_id)
  .lte('scheduled_at', new Date().toISOString())
  .order('priority', { ascending: true })
  .order('scheduled_at', { ascending: true })
  .limit(5);  // Busca 5 mensagens, não apenas a que foi enviada agora!
```

O problema e que a funcao envia **qualquer mensagem pendente da instancia**, nao apenas a mensagem que o atendente acabou de enviar.

---

### Solucao Proposta

#### Opcao A: Envio Direto para Mensagens Manuais (Recomendado)

Desabilitar a fila para mensagens enviadas manualmente pelos atendentes. A fila deve ser usada apenas para mensagens automaticas (IA, bots, templates agendados).

**Modificacao em** `supabase/functions/send-whatsapp-message/index.ts`:

```typescript
// ANTES: useQueue era true por padrão
const useQueue = !isMediaMessage && body.use_queue !== false;

// DEPOIS: useQueue é false por padrão para mensagens manuais
// Apenas usar fila se explicitamente solicitado (ex: envios em massa, IA)
const useQueue = body.use_queue === true;
```

**Modificacao no frontend** `src/components/inbox/SuperComposer.tsx`:

```typescript
// Garantir que mensagens manuais nunca usem fila
const { error: evolutionError } = await supabase.functions.invoke('send-whatsapp-message', {
  body: {
    instance_id: whatsappInstanceId,
    phone_number: contactPhone,
    message: messageContent,
    delay: 1000,
    use_queue: false, // NOVO: Desabilitar fila para envio manual
  }
});
```

#### Opcao B: Isolar Mensagem na Fila (Alternativa)

Se a fila for necessaria, modificar para processar **apenas a mensagem recem-criada**, nao todas as pendentes:

```typescript
// ANTES: Busca qualquer mensagem pendente
const { data: pendingMessages } = await supabase
  .from('message_queue')
  .select('*')
  .eq('status', 'pending')
  .eq('instance_id', body.instance_id)
  ...

// DEPOIS: Busca apenas a mensagem recem-enfileirada
const { data: pendingMessages } = await supabase
  .from('message_queue')
  .select('*')
  .eq('id', queuedMessage.id) // APENAS a mensagem que acabou de ser criada
  .eq('status', 'pending');
```

---

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/send-whatsapp-message/index.ts` | Desabilitar fila por padrao para mensagens manuais (`use_queue = false`) |
| `src/components/inbox/SuperComposer.tsx` | Adicionar `use_queue: false` explicitamente nas chamadas |
| `supabase/functions/ai-autopilot-chat/index.ts` | Verificar se IA deve usar fila (opcional) |

---

### Beneficios da Correção

- **Mensagens enviadas imediatamente**: O que o atendente digita e o que o cliente recebe
- **Sem interferência de mensagens antigas**: Mensagens falhadas/pendentes nao "vazam" para outras conversas
- **Fila continua util para automacao**: Bots, IAs e envios em massa ainda podem usar a fila

---

### Secao Tecnica

**Codigo principal da correcao:**

```typescript
// supabase/functions/send-whatsapp-message/index.ts

// Linha ~62: Inverter logica - fila e opt-in, nao opt-out
const isMediaMessage = !!body.media_url && !!body.media_type;
const useQueue = body.use_queue === true && !isMediaMessage; // Fila apenas se explicitamente solicitado

// Se nao usar fila, enviar diretamente (comportamento antigo, seguro)
if (!useQueue) {
  // ... codigo de envio direto existente (linhas 293+)
}
```

```typescript
// src/components/inbox/SuperComposer.tsx

// Adicionar use_queue: false em todas as chamadas de envio manual
const { error: evolutionError } = await supabase.functions.invoke('send-whatsapp-message', {
  body: {
    instance_id: whatsappInstanceId,
    phone_number: contactPhone,
    message: messageContent,
    delay: 1000,
    use_queue: false, // Envio direto, sem fila
  }
});
```

---

### Impacto

| Area | Impacto |
|------|---------|
| Mensagens manuais | Envio imediato e direto, sem fila |
| Mensagens de IA | Podem continuar usando fila (com `use_queue: true`) |
| Rate limiting | Aplicado apenas para envios em massa/automatizados |
| Performance | Melhor responsividade para atendentes |

