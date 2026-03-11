

# Diagnóstico: Conversa #1CBA9A9B — Transfer e Anti-Spam Quebrados

## O que aconteceu

**Timeline:**
1. **13:22** — Conversa criada, flow processou e transferiu (status `transferred`) para departamento **Suporte**
2. **13:23** — Dispatch job criado para Suporte
3. **13:23 → 13:58** — Dispatch tentou 9 vezes, **TODOS os 8 agentes de Suporte estavam OFFLINE**. Resultado: `no_agents_available`
4. **13:44 → 13:46** — Contato enviou 4 mensagens em 2 minutos, recebeu **4x a mesma mensagem** "Sua conversa já está na fila de atendimento"
5. **~13:58** — Mabile Silva (Suporte Sistema) foi atribuída **manualmente**

## 2 Bugs Identificados

### Bug 1: Anti-spam da mensagem "fila" NUNCA funciona

O rate-limit de 2 minutos filtra por `is_ai_generated: true`:
```typescript
.eq("is_ai_generated", true)  // ← BUG
```

Porém, o `send-meta-whatsapp` salva essas mensagens com `is_ai_generated: false`. O filtro nunca encontra mensagens anteriores → rate-limit nunca ativa → **contato recebe spam** a cada mensagem enviada.

**Prova:** As 4 mensagens "fila de atendimento" no banco têm `is_ai_generated: false`.

### Bug 2: Sem fallback quando TODOS os agentes estão offline

Quando o dispatch falha todas as tentativas, a conversa fica no limbo: `waiting_human` sem assigned_to, sem ninguém para atender. O contato fica preso recebendo "fila de atendimento" indefinidamente.

## Solução

### Correção 1: Anti-spam funcional (meta-whatsapp-webhook)

Mudar o filtro de `is_ai_generated: true` para verificar por `content` da mensagem de fila:

```typescript
const { data: lastBotMsg } = await supabase
  .from("messages")
  .select("created_at, content")
  .eq("conversation_id", conversation.id)
  .eq("sender_type", "user")
  .ilike("content", "%fila de atendimento%")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
```

Isso garante que, não importa como a mensagem foi salva, o rate-limit encontra a mensagem anterior corretamente.

### Correção 2: Mensagem honesta quando nenhum agente está online

Depois de verificar que `shouldSendQueueMsg = true`, adicionar verificação de agentes online no departamento. Se nenhum estiver online, enviar mensagem alternativa:

```
"⏳ Nosso time de atendimento não está disponível no momento. 
Assim que um especialista ficar online, você será atendido automaticamente."
```

Isso é melhor que "em breve um especialista irá te atender" quando ninguém está online.

### Arquivos alterados
- `supabase/functions/meta-whatsapp-webhook/index.ts` — corrigir filtro anti-spam + mensagem offline

