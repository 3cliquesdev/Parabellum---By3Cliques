

# Plano: Processamento em Lote (Batch) para Distribuição Enterprise

## Problema Identificado

O `dispatch-conversations` processa **1 job por vez** em um loop sequencial:

```typescript
// ATUAL - SEQUENCIAL (LENTO)
for (const job of pendingJobs) {  // 10 jobs
  await lockJob(job);             // ~50ms
  await verifyConversation();     // ~50ms  
  await findEligibleAgent();      // ~100ms
  await assignConversation();     // ~50ms
  await logAssignment();          // ~50ms
}
// Total: 10 × 300ms = 3 SEGUNDOS por ciclo
```

**Resultado:** Com 10 jobs na fila e cron a cada 60 segundos, demora até 3 segundos por ciclo - mas ainda precisa esperar o próximo minuto!

---

## Solução: Processamento Paralelo com Batches

Processar múltiplos jobs em paralelo usando `Promise.all`:

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                    ANTES (Sequencial)                                     │
├───────────────────────────────────────────────────────────────────────────┤
│  Job1 ────▶ Job2 ────▶ Job3 ────▶ Job4 ────▶ Job5 ...                     │
│  300ms     300ms      300ms      300ms      300ms                         │
│  Total: 10 jobs × 300ms = 3000ms (3 segundos)                             │
└───────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                    DEPOIS (Paralelo em Batches de 5)                      │
├───────────────────────────────────────────────────────────────────────────┤
│  [Job1, Job2, Job3, Job4, Job5] ────▶ [Job6, Job7, Job8, Job9, Job10]     │
│         300ms (paralelo)                      300ms (paralelo)            │
│  Total: 2 batches × 300ms = 600ms (0.6 segundos)                          │
└───────────────────────────────────────────────────────────────────────────┘
```

**Ganho: 5x mais rápido!**

---

## Alterações a Implementar

### 1. Edge Function: `dispatch-conversations/index.ts`

Mudar de loop sequencial para processamento em batches paralelos:

**Código Atual (linhas 78-235):**
```typescript
for (const job of pendingJobs as DispatchJob[]) {
  // processar cada job sequencialmente
}
```

**Código Novo:**
```typescript
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES_MS = 100;

// Processar em batches paralelos
for (let i = 0; i < pendingJobs.length; i += BATCH_SIZE) {
  const batch = pendingJobs.slice(i, i + BATCH_SIZE);
  
  // Processar batch em paralelo
  const batchResults = await Promise.allSettled(
    batch.map((job: DispatchJob) => processJob(supabase, job))
  );
  
  // Agregar resultados
  for (const result of batchResults) {
    if (result.status === 'fulfilled') {
      const jobResult = result.value;
      if (jobResult.status === 'assigned') assigned++;
      else if (jobResult.status === 'failed') failed++;
      results.push(jobResult);
    } else {
      failed++;
    }
  }
  
  // Pequeno delay entre batches para não sobrecarregar
  if (i + BATCH_SIZE < pendingJobs.length) {
    await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES_MS));
  }
}
```

### 2. Extrair Lógica de Job para Função

Criar função `processJob()` que encapsula toda a lógica de um job individual:

```typescript
async function processJob(
  supabase: any,
  job: DispatchJob
): Promise<{ conversation_id: string; status: string; agent?: string; reason?: string }> {
  const jobStartTime = Date.now();
  
  // 1. Lock atômico
  const { data: lockedJob } = await supabase
    .from('conversation_dispatch_jobs')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('id', job.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (!lockedJob) {
    return { conversation_id: job.conversation_id, status: 'skipped', reason: 'already_locked' };
  }

  // 2. Verificar conversa
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, ai_mode, assigned_to, department, status')
    .eq('id', job.conversation_id)
    .single();

  if (!conversation) {
    await markJobComplete(supabase, job.id, 'conversation_not_found');
    return { conversation_id: job.conversation_id, status: 'skipped', reason: 'not_found' };
  }

  // ... resto da lógica (findEligibleAgent, assign, etc.)
}
```

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/dispatch-conversations/index.ts` | Refatorar para processamento paralelo em batches |

---

## Impacto

### Performance

| Cenário | Antes | Depois |
|---------|-------|--------|
| 10 jobs na fila | 3000ms | 600ms |
| 50 jobs na fila | 15000ms | 3000ms |
| Tempo de espera máximo do cliente | ~60s (aguardar cron) | ~12s |

### Segurança

| Controle | Status |
|----------|--------|
| Lock atômico por job | ✅ Mantido |
| Race condition handling | ✅ Mantido |
| Sem duplicação de atribuição | ✅ Mantido |
| Logs de auditoria | ✅ Mantido |

---

## Fluxo Visual

```text
Fila (10 jobs)         dispatch-conversations              Agentes
      |                         |                              |
      |                    [Batch 1: 5 jobs]                   |
      |                         |                              |
      |---Job1----------------->|                              |
      |---Job2----------------->|   (paralelo)                 |
      |---Job3----------------->|                              |
      |---Job4----------------->|                              |
      |---Job5----------------->|                              |
      |                         |---assign Job1--------------->|
      |                         |---assign Job2--------------->|
      |                         |---assign Job3--------------->|
      |                         |---assign Job4--------------->|
      |                         |---assign Job5--------------->|
      |                         |                              |
      |                    [Delay 100ms]                       |
      |                         |                              |
      |                    [Batch 2: 5 jobs]                   |
      |                         |                              |
      |---Job6----------------->|                              |
      |---Job7----------------->|   (paralelo)                 |
      |---Job8----------------->|                              |
      |---Job9----------------->|                              |
      |---Job10---------------->|                              |
      |                         |---assign Job6--------------->|
      |                         |---...                        |
```

---

## Compatibilidade

- ✅ Lock atômico previne race conditions mesmo com paralelismo
- ✅ Cada job ainda é processado de forma isolada
- ✅ Erros em um job não afetam outros do batch
- ✅ Escalação funciona normalmente
- ✅ Logs de auditoria mantidos

---

## Seção Técnica

### Parâmetros de Tuning

| Parâmetro | Valor | Justificativa |
|-----------|-------|---------------|
| `BATCH_SIZE` | 5 | Balanceia paralelismo vs carga no banco |
| `DELAY_BETWEEN_BATCHES` | 100ms | Evita throttling, permite outros requests |
| `LIMIT` | 50 | Já existe, mantém |

### Promise.allSettled vs Promise.all

Usamos `Promise.allSettled` porque:
- Não falha se um job falhar
- Retorna status de cada promise individualmente
- Permite continuar processando mesmo com erros parciais

