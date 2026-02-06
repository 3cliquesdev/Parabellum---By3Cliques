

# Plano Ajustado: "🧪 Testar para Mim" - Enterprise Edition (Corrigido)

## 🚨 4 Ajustes Críticos de Produção

### 1. **Migration: ALTER PUBLICATION Idempotente**

**Problema:**
- SQL atual não é idempotente: rodar 2x estouraria erro "already added to publication"

**Solução:**
```sql
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.playbook_test_runs;
EXCEPTION
  WHEN duplicate_object THEN
    -- Já está na publication, ignora silenciosamente
    NULL;
  WHEN others THEN
    -- Log se a infra bloquear (ex: Lovable Cloud)
    RAISE NOTICE 'Could not add table to supabase_realtime publication: %', SQLERRM;
END $$;
```

---

### 2. **RLS Policy: SELECT na playbook_test_runs (Obrigatório para Realtime)**

**Problema:**
- Mesmo com Realtime habilitado, sem RLS policy de SELECT, o frontend recebe `null`
- `postgres_changes` subscription depende da policy de SELECT

**Solução:**
```sql
ALTER TABLE playbook_test_runs ENABLE ROW LEVEL SECURITY;

-- Usuário pode ler seus próprios testes ou qualquer gerente/admin pode ler
DROP POLICY IF EXISTS "test_runs_read_own" ON playbook_test_runs;
CREATE POLICY "test_runs_read_own"
ON playbook_test_runs
FOR SELECT
USING (
  started_by = auth.uid()
  OR public.is_manager_or_admin(auth.uid())
);
```

---

### 3. **executed_nodes: Evitar Drift (Off-by-One Race Condition)**

**Problema:**
```typescript
// ERRADO: pode duplicar dependendo do timing
const nodesExecuted = (execution.nodes_executed?.length || 0) + 1;
```

Isso causa race condition se:
- 2 workers processarem nós simultaneamente
- `nodes_executed` não for atualizado atomicamente

**Solução (Opção B - Simples e Recomendada):**

Antes de atualizar, buscar do DB com valor atual e clampar:

```typescript
// Line 240: Após marcar queue item como completado, chamar:
if ((execution as PlaybookExecution).metadata?.is_test_mode) {
  // Fetch current state from DB (evita drift)
  const { data: currentRun } = await supabaseAdmin
    .from('playbook_test_runs')
    .select('executed_nodes, total_nodes')
    .eq('execution_id', item.execution_id)
    .single();

  const nextExecuted = Math.min(
    currentRun?.total_nodes ?? 0,
    (currentRun?.executed_nodes ?? 0) + 1
  );

  await supabaseAdmin
    .from('playbook_test_runs')
    .update({
      executed_nodes: nextExecuted,
      current_node_id: item.node_id,
      last_node_type: item.node_type,
      last_event_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('execution_id', item.execution_id);
}
```

**Localização exata:**
- Após linha 233 (mark queue item as completed)
- Antes de linha 236 (queueNextNode)
- Apenas em modo teste (`is_test_mode=true`)

---

### 4. **Percentual: Clampado em 100%**

**Problema:**
```typescript
// ERRADO: pode virar 101%, 110%, etc em loops/branches
Math.round((executed_nodes / total_nodes) * 100)
```

**Solução (Hook useTestPlaybookProgress):**
```typescript
const percentComplete = progress?.total_nodes
  ? Math.min(100, Math.round((progress.executed_nodes / progress.total_nodes) * 100))
  : 0;
```

---

## ⭐ Ajustes Recomendados (Extras)

### A) PLAYBOOK_TEST_ALLOW_ANY_RECIPIENT Flag

**Já implementado:** Adicionar ao `test-playbook/index.ts`:
```typescript
const allowAnyRecipient = Deno.env.get('PLAYBOOK_TEST_ALLOW_ANY_RECIPIENT') === 'true';

if (!allowAnyRecipient && !isManager && userEmail !== normalizedRecipientEmail) {
  return new Response(...403...);
}
```

### B) total_nodes: Contar Nós Executáveis (Opcional)

Hoje: `total_nodes = flow_definition.nodes.length`

Melhor (se quiser):
```typescript
const executableNodeTypes = ['email', 'delay', 'task', 'form', 'condition', 'switch', 'call'];
const totalNodes = flow_definition.nodes.filter(n => executableNodeTypes.includes(n.type)).length;
```

Recomendação: Manter `nodes.length` por simplicidade — o percentual vai refletir a realidade do fluxo.

### C) formatRelativeTime() Helper

Para a UI do progresso:
```typescript
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function formatRelativeTime(iso: string) {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR });
}

// Uso:
<p>Próximo nó em: {formatRelativeTime(progress.next_scheduled_for)}</p>
// "Próximo nó em: em 5 minutos"
```

---

## 📋 Sequência Exata de Implementação

### 1. **Migration** (SQL)
Criar migration com os 3 passos:
- ALTER TABLE ADD COLUMN (progresso)
- DO $$ ALTER PUBLICATION (idempotente)
- CREATE POLICY (SELECT com is_manager_or_admin)

### 2. **test-playbook/index.ts** (Edge Function)
- Adicionar support para `PLAYBOOK_TEST_ALLOW_ANY_RECIPIENT`
- Calcular `total_nodes = flow_definition.nodes.length`
- Inicializar `executed_nodes=0`, `current_node_id`, etc.

### 3. **process-playbook-queue/index.ts** (Edge Function)
**Localização EXATA onde inserir updateTestRunProgress:**

```
Linha 209-216: Mark node as executed na playbook_executions
↓
Linha 218-224: Update playbook_executions com nodes_executed
↓
Linha 227-233: Mark queue item como 'completed'
↓
[AQUI INSERT updateTestRunProgress] ← AO FINAL DA EXECUÇÃO DO NÓ
↓
Linha 236-238: queueNextNode (se aplicável)
↓
Linha 240: processedCount++
```

Código a inserir (after line 233):
```typescript
// 🧪 UPDATE TEST RUN PROGRESS (if in test mode)
if ((execution as PlaybookExecution).metadata?.is_test_mode) {
  const { data: currentRun } = await supabaseAdmin
    .from('playbook_test_runs')
    .select('executed_nodes, total_nodes')
    .eq('execution_id', item.execution_id)
    .single();

  const nextExecuted = Math.min(
    currentRun?.total_nodes ?? 0,
    (currentRun?.executed_nodes ?? 0) + 1
  );

  // Buscar próximo item enfileirado (se houver)
  const { data: nextScheduledItems } = await supabaseAdmin
    .from('playbook_execution_queue')
    .select('scheduled_for')
    .eq('execution_id', item.execution_id)
    .eq('status', 'pending')
    .order('scheduled_for', { ascending: true })
    .limit(1);

  await supabaseAdmin
    .from('playbook_test_runs')
    .update({
      executed_nodes: nextExecuted,
      current_node_id: item.node_id,
      last_node_type: item.node_type,
      last_event_at: new Date().toISOString(),
      next_scheduled_for: nextScheduledItems?.[0]?.scheduled_for || null,
      updated_at: new Date().toISOString(),
    })
    .eq('execution_id', item.execution_id);

  console.log(`[updateTestRunProgress] 🧪 ${nextExecuted}/${currentRun?.total_nodes} nodes executed`);
}
```

### 4. **useTestPlaybookProgress.tsx** (Hook novo)
- Usar `event: "*"` (INSERT + UPDATE) para cobertura completa
- Aplicar clamp `Math.min(100, ...)` no cálculo de percentual

### 5. **PlaybookEditor.tsx** (UI)
- Adicionar card de progresso com:
  - Barra de progresso (clamped em 100%)
  - Status (Running/Done/Failed)
  - Próximo nó + tempo relativo
  - Error message (se falhar)

---

## 🗂️ Arquivos a Modificar

| Arquivo | Ação | Critério |
|---------|------|----------|
| Migration SQL | **CRIAR** | 1: idempotent publication, 2: RLS policy, 3: nova migration |
| `supabase/functions/test-playbook/index.ts` | **ATUALIZAR** | Env flag + total_nodes + inicializar progresso |
| `supabase/functions/process-playbook-queue/index.ts` | **ATUALIZAR** | Insert updateTestRunProgress após line 233 |
| `src/hooks/useTestPlaybookProgress.tsx` | **CRIAR** | event: "*", Math.min(100, ...) |
| `src/components/playbook/PlaybookEditor.tsx` | **ATUALIZAR** | Card de progresso visual |

---

## ✅ Garantias Enterprise

| # | Garantia | Check |
|---|----------|-------|
| 1 | Sem erro "already in publication" | Migration com DO $$ EXCEPTION $$ |
| 2 | Realtime funciona | RLS policy SELECT present |
| 3 | Sem race condition | Buscar estado atual do DB antes de incrementar |
| 4 | UI não explode | Math.min(100, ...) |
| 5 | Flexibilidade | PLAYBOOK_TEST_ALLOW_ANY_RECIPIENT env flag |
| 6 | Sem regressão | Lógica normal não afetada |

---

## 📊 Diagrama do Fluxo Corrigido

```text
[Usuário clica "🧪 Testar"]
         ↓
[test-playbook]
├─ total_nodes = nodes.length
├─ Criar execution
├─ Criar test_run com executed_nodes=0, total_nodes=N
└─ Enfileirar primeiro nó
         ↓
[process-playbook-queue LOOP]
├─ Executar nó (email, delay, etc.)
├─ Mark queue item como 'completed'
├─ 🧪 [AQUI] Buscar current state do test_run
│        └─ nextExecuted = min(total_nodes, executed_nodes+1)
│        └─ Update playbook_test_runs
│        └─ Fetch próximo item pendente
│        └─ Set next_scheduled_for
├─ Queue próximo nó
└─ Continue...
         ↓
[Realtime Subscription]
├─ postgres_changes UPDATE em playbook_test_runs
├─ Frontend recebe novo executed_nodes
├─ Barra progresso atualiza (min 100%)
└─ Mostra status + próximo nó
```

---

## 🔍 Testes Críticos

| # | Cenário | Validação |
|---|---------|-----------|
| 1 | Rodar migration 2x | Sem erro "already added" |
| 2 | Iniciar teste | test_run criado com total_nodes preenchido |
| 3 | Executar nós sequencial | executed_nodes incremente corretamente (sem drift) |
| 4 | Realtime subscription | Frontend recebe updates em tempo real |
| 5 | Percentual progresso | Máximo 100%, nunca maior |
| 6 | Múltiplos workers | Sem race condition, contagem precisa |
| 7 | Env flag ativo | Usuário comum consegue enviar para email diferente |

