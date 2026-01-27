

## Plano: Otimizar Velocidade de Mensagens na Versao Publicada

### Diagnostico do Problema

Analisei os logs, codigo e arquitetura do sistema. Identifiquei as causas da diferenca de velocidade:

| Fator | Preview | Producao | Impacto |
|-------|---------|----------|---------|
| Edge Functions Cold Start | Quente (uso continuo) | Frios (inatividade) | +500ms a +3s por funcao |
| Supabase Realtime | Mesma conexao | Reconexao frequente | +200ms a +1s |
| AI Autopilot Processing | Mesmo fluxo | Mesmo fluxo | ~5-11s (normal) |
| Cascata de funcoes | 3 funcoes em serie | 3 funcoes em serie | Acumulativo |

**Causa Principal**: No preview, voce esta constantemente usando o app, mantendo as Edge Functions "quentes". Na producao, apos minutos de inatividade, as funcoes entram em "cold start" e precisam ser inicializadas novamente a cada requisicao.

---

### Arquitetura Atual (Lenta)

```text
Mensagem WhatsApp Recebida
         |
         v
[meta-whatsapp-webhook] - Cold Start: 30-60ms (OK)
         |
         v
INSERT mensagem no banco
         |
         v
[ai-autopilot-chat] - Cold Start: 500-1500ms (LENTO)
         |
         v
Processa IA (5-11s normal)
         |
         v
[send-meta-whatsapp] - Cold Start: 300-800ms (LENTO)
         |
         v
Mensagem enviada
```

**Total com cold starts**: 6-14 segundos
**Total sem cold starts**: 5-11 segundos

---

### Solucoes Propostas

#### Solucao 1: Implementar Keep-Alive para Edge Functions (Rapida)

Criar uma Edge Function CRON que "aquece" as funcoes criticas a cada 5 minutos:

**Arquivo novo**: `supabase/functions/keep-alive/index.ts`

Esta funcao fara chamadas leves para:
- `meta-whatsapp-webhook` (GET para verificacao)
- `ai-autopilot-chat` (POST com body vazio - retorna rapido)
- `send-meta-whatsapp` (POST com validacao minima)

**Configuracao CRON**: `*/5 * * * *` (a cada 5 minutos)

---

#### Solucao 2: Otimizar Realtime no Frontend (Media)

Atualizar `useInboxView.tsx` para:
1. Usar `refetchInterval: 10000` ao inves de 15000 (mais responsivo)
2. Adicionar reconexao automatica mais agressiva
3. Implementar heartbeat para manter conexao Realtime ativa

**Arquivo**: `src/hooks/useInboxView.tsx`

---

#### Solucao 3: Pre-aquecer Conexoes de IA (Media)

No `ai-autopilot-chat`, fazer lazy initialization do cliente OpenAI/Google no cold start, mas manter um "ping" de validacao rapida.

**Arquivo**: `supabase/functions/ai-autopilot-chat/index.ts`

---

#### Solucao 4: Resposta Imediata + Processamento Assincrono (Avancada)

Modificar `meta-whatsapp-webhook` para:
1. Responder 200 OK ao Meta imediatamente
2. Processar mensagem em background (fire-and-forget)
3. AI processa enquanto webhook ja encerrou

**Arquivo**: `supabase/functions/meta-whatsapp-webhook/index.ts`

---

### Arquivos a Criar/Modificar

| Arquivo | Acao | Prioridade |
|---------|------|------------|
| `supabase/functions/keep-alive/index.ts` | Criar | ALTA |
| `supabase/config.toml` | Modificar (adicionar CRON) | ALTA |
| `src/hooks/useInboxView.tsx` | Modificar | MEDIA |
| `supabase/functions/ai-autopilot-chat/index.ts` | Modificar | MEDIA |
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Modificar | BAIXA |

---

### Detalhes Tecnicos

#### Keep-Alive Edge Function

```typescript
// supabase/functions/keep-alive/index.ts
serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  
  // Aquecer funcoes criticas em paralelo
  const warmups = await Promise.allSettled([
    // 1. meta-whatsapp-webhook (GET = verificacao)
    fetch(`${supabaseUrl}/functions/v1/meta-whatsapp-webhook?hub.mode=warmup`),
    
    // 2. ai-autopilot-chat (POST com flag warmup)
    fetch(`${supabaseUrl}/functions/v1/ai-autopilot-chat`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ warmup: true })
    }),
    
    // 3. send-meta-whatsapp (POST com flag warmup)
    fetch(`${supabaseUrl}/functions/v1/send-meta-whatsapp`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ warmup: true })
    }),
  ]);
  
  return new Response(JSON.stringify({ warmed: warmups.length }));
});
```

#### Modificacao em ai-autopilot-chat

Adicionar no inicio da funcao serve():

```typescript
// Handler de warmup rapido (sem processamento)
if (req.method === 'POST') {
  const body = await req.json().catch(() => ({}));
  if (body.warmup) {
    console.log('[ai-autopilot-chat] Warmup ping received');
    return new Response(JSON.stringify({ status: 'warm' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
```

#### CRON no config.toml

```toml
[functions.keep-alive]
verify_jwt = false

[functions.keep-alive.cron]
schedule = "*/5 * * * *"
region = "us-east-1"
```

---

### Resultado Esperado

| Metrica | Antes | Depois |
|---------|-------|--------|
| Cold start acumulado | 1-3 segundos | ~100ms |
| Tempo total de resposta | 6-14 segundos | 5-12 segundos |
| Consistencia | Variavel | Estavel |
| Custo adicional | N/A | ~8640 invocacoes/mes (minimo) |

---

### Implementacao em Fases

**Fase 1 (Imediata)**: Keep-alive CRON + handlers de warmup
**Fase 2 (Proxima)**: Otimizar Realtime no frontend
**Fase 3 (Futura)**: Processamento assincrono no webhook

