

# Correção: Resposta Duplicada por Race Condition no Buffer

## Diagnóstico da conversa #41B87BAB

**Timeline:**
- 16:02:37–16:03:21 — Cliente enviou 4 mensagens rápidas
- 16:03:50 — Cron #1 pegou 3 msgs do buffer → chamou IA
- 16:04:05 — Cron #2 pegou as MESMAS 3 msgs → chamou IA de novo
- 16:04:26 — Resposta boa: "Parabéns pela primeira venda!" ✅
- 16:04:38 — Resposta duplicada genérica: "Olá! Estou aqui para te ajudar" ❌

**Causa raiz**: O advisory lock (`pg_try_advisory_xact_lock`) não funciona porque o Supabase JS client faz auto-commit em cada query. O lock é liberado imediatamente após o RPC retornar, antes de processar. Duas execuções do cron leem as mesmas mensagens `processed=false`.

## Correção

### 1. Locking otimista no `process-buffered-messages/index.ts`

Substituir o padrão atual (advisory lock + SELECT + process + UPDATE) por **claim atômico**: fazer UPDATE...SET processed=true WHERE processed=false RETURNING antes de chamar a IA. Se nenhuma row retornar, outro worker já pegou.

```
// ANTES (quebrado):
const gotLock = await rpc("try_lock_conversation_buffer")
const msgs = await select().eq("processed", false)  // race window!
await callPipeline(...)
await update({ processed: true })

// DEPOIS (atômico):
const msgs = await update({ processed: true })
  .eq("conversation_id", convId)
  .eq("processed", false)
  .lte("created_at", cutoffTime)
  .select("*")  // RETURNING — pega e marca atomicamente
if (!msgs.length) continue;  // outro worker já pegou
await callPipeline(...)
// Se falhar, desfazer: update({ processed: false })
```

### 2. Rollback em caso de falha do pipeline

Se `callPipeline` falhar, reverter `processed` para `false` nos IDs afetados para permitir retry no próximo ciclo.

### 3. Manter advisory lock como proteção extra (opcional)

Não remover o RPC de lock — mantê-lo como segunda camada, mas a proteção primária agora é o claim atômico.

## Arquivo alterado
- `supabase/functions/process-buffered-messages/index.ts` — linhas 106-195 (CRON mode loop)

## Impacto
- Elimina respostas duplicadas quando o cron processa a mesma conversa em execuções sobrepostas
- Zero risco de quebrar funcionalidades existentes — o flow, pipeline, retry e quota handling continuam iguais
- Mensagens que falharem no pipeline continuam sendo retentadas (rollback de processed)

