
# Plano: Ajuste D0 → D4 - Correções Indispensáveis

## Diagnóstico Atual

### O que está funcionando
- Trigger `BEFORE INSERT OR UPDATE` existe e está ativo
- Jobs estão sendo criados (31 jobs pending)
- Recovery de conversas órfãs funcionou

### Problemas Identificados

| Problema | Causa | Impacto |
|----------|-------|---------|
| Dispatcher diz "No pending jobs" | Jobs criados às 07:55, último ciclo às 07:51 | Jobs não processados |
| 0 agentes online em depts com jobs | Comercial, Suporte Sistema, Suporte Pedidos sem online | Nenhuma atribuição possível |
| Código usa status `'pending'` | Enum só tem: `open`, `resolved`, `closed`, `waiting_human` | Erro silencioso na contagem |
| Trigger usa lógica robusta mas sem detalhe de UPDATE OF | Trigger dispara em QUALQUER update, não só campos relevantes | Performance desnecessária |

---

## Alterações Propostas

### 1. Migration SQL - Trigger Refinado (D0)

```sql
-- Função robusta que verifica ESTADO ATUAL
CREATE OR REPLACE FUNCTION public.ensure_dispatch_job()
RETURNS TRIGGER AS $$
BEGIN
  -- Se conversa elegível para distribuição, garante job pendente
  IF NEW.ai_mode = 'waiting_human'
     AND NEW.assigned_to IS NULL
     AND NEW.department IS NOT NULL
     AND NEW.status = 'open'  -- Só 'open' é válido no enum
  THEN
    INSERT INTO public.conversation_dispatch_jobs (conversation_id, department_id, priority)
    VALUES (NEW.id, NEW.department, 1)
    ON CONFLICT (conversation_id)
    DO UPDATE SET
      department_id   = EXCLUDED.department_id,
      status          = CASE 
        WHEN conversation_dispatch_jobs.status = 'completed' 
        THEN 'pending'  -- Reativa job se foi completo mas voltou a precisar
        ELSE 'pending'
      END,
      next_attempt_at = now(),
      updated_at      = now();
  END IF;

  -- Se atribuiu agente, encerra job
  IF NEW.assigned_to IS NOT NULL THEN
    UPDATE public.conversation_dispatch_jobs
    SET status = 'completed', updated_at = now()
    WHERE conversation_id = NEW.id
      AND status <> 'completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Triggers separados para INSERT e UPDATE (melhor performance)
DROP TRIGGER IF EXISTS trg_dispatch_on_conversation_insert ON public.conversations;
DROP TRIGGER IF EXISTS trg_dispatch_on_conversation_update ON public.conversations;
DROP TRIGGER IF EXISTS trigger_conversation_dispatch ON public.conversations;

-- INSERT: sempre verifica
CREATE TRIGGER trg_dispatch_on_conversation_insert
  AFTER INSERT ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_dispatch_job();

-- UPDATE: só dispara quando campos relevantes mudam
CREATE TRIGGER trg_dispatch_on_conversation_update
  AFTER UPDATE OF ai_mode, assigned_to, department, status ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_dispatch_job();
```

### 2. Edge Function - Corrigir Contagem de Capacidade (D3)

**Problema**: Código usa `status IN ('open', 'pending')` mas `pending` não existe no enum.

**Arquivo**: `supabase/functions/dispatch-conversations/index.ts`

```typescript
// ANTES (ERRADO):
.in('status', ['open', 'pending'])

// DEPOIS (CORRETO):
.eq('status', 'open')  // Só 'open' é válido
```

### 3. Edge Function - Incluir waiting_human na Capacidade (D3)

**Problema**: Conta só `copilot` e `disabled`, mas `waiting_human` também é carga se atribuído.

```typescript
// ANTES:
.in('ai_mode', ['copilot', 'disabled'])

// DEPOIS - Contar TODAS as conversas atribuídas ao agente:
.in('ai_mode', ['waiting_human', 'copilot', 'disabled'])
.eq('status', 'open')
```

### 4. Garantir CRON está chamando o Dispatcher

Verificar `cron-process-queue` está invocando `dispatch-conversations`:

```typescript
// D4: Process conversation dispatch jobs
const { data: dispatchData, error: dispatchError } = await supabase.functions.invoke("dispatch-conversations", {
  body: { source: "cron" }
});
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| **Nova Migration SQL** | Trigger `ensure_dispatch_job` refinado com INSERT e UPDATE OF |
| `supabase/functions/dispatch-conversations/index.ts` | Corrigir `'pending'` → `'open'` e incluir `waiting_human` na capacidade |

---

## Fluxo Corrigido

```text
1. Conversa criada/atualizada com:
   ai_mode = 'waiting_human'
   assigned_to = NULL
   department = UUID
   status = 'open'
           │
           ▼
2. TRIGGER (INSERT ou UPDATE OF ai_mode,assigned_to,department,status):
   Estado atual exige distribuição?
   → SIM: UPSERT job com status='pending'
           │
           ▼
3. CRON (cada 30-60s via cron-process-queue):
   → Chama dispatch-conversations
   → Busca jobs pending com next_attempt_at <= now()
   → Para cada job:
     a. Lock atômico (UPDATE WHERE status='pending')
     b. Verificar conversa ainda precisa
     c. Buscar agentes:
        - online
        - no departamento OU parent
        - com capacity (waiting_human+copilot+disabled < max)
     d. Se encontrou → Atribuir atomicamente
     e. Se não → Retry com backoff
           │
           ▼
4. Resultado:
   - Agente atribuído → job completo
   - Nenhum agente → retry até TTL → escalated
   - Dept sem agentes → manual_only
```

---

## Situação Atual dos Departamentos

| Departamento | Jobs Pending | Agentes Online | Ação Esperada |
|--------------|--------------|----------------|---------------|
| Comercial | 17 | 0 (Thaynara busy) | Retry até alguém online |
| Suporte Sistema | 12 | 0 | Fallback para parent (Suporte) |
| Suporte Pedidos | 2 | 0 | Fallback para parent (Suporte) |
| **Suporte (parent)** | - | 0 (Camila busy) | Nenhum online também |

**Conclusão**: Nenhum agente está `online` nos departamentos com jobs. O sistema está funcionando corretamente - ele tentará atribuir quando alguém ficar online.

---

## Detalhes Técnicos

### Correção da Contagem de Capacidade

```typescript
// Linha ~335-340 em dispatch-conversations/index.ts
// ANTES:
const { data: activeConvs } = await supabase
  .from('conversations')
  .select('assigned_to')
  .in('ai_mode', ['copilot', 'disabled']) // Falta waiting_human
  .in('status', ['open', 'pending'])       // 'pending' não existe!
  .in('assigned_to', profiles.map((p: { id: string }) => p.id));

// DEPOIS:
const { data: activeConvs } = await supabase
  .from('conversations')
  .select('assigned_to')
  .in('ai_mode', ['waiting_human', 'copilot', 'disabled']) // Todas as cargas humanas
  .eq('status', 'open')  // Só 'open' é válido
  .in('assigned_to', profiles.map((p: { id: string }) => p.id));
```

### Trigger com UPDATE OF

```sql
-- UPDATE OF restringe trigger para disparar APENAS quando esses campos mudam
-- Evita processamento desnecessário em updates de outros campos
CREATE TRIGGER trg_dispatch_on_conversation_update
  AFTER UPDATE OF ai_mode, assigned_to, department, status ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_dispatch_job();
```

---

## Validação Pós-Implementação

1. **Testar INSERT**: Criar conversa já em `waiting_human` → job deve ser criado
2. **Testar UPDATE**: Mudar `ai_mode` para `waiting_human` → job deve ser criado
3. **Testar atribuição**: Atribuir agente → job deve ser marcado `completed`
4. **Verificar capacidade**: Agente online com 0 chats → deve receber atribuição
5. **Fallback parent**: Conversa em "Suporte Sistema" → deve buscar agentes em "Suporte" também

---

## Resumo das Correções

| Problema | Correção |
|----------|----------|
| Trigger dispara em qualquer update | `UPDATE OF ai_mode, assigned_to, department, status` |
| Status `'pending'` inválido | Usar apenas `'open'` |
| Capacidade não conta `waiting_human` | Incluir `waiting_human` no IN |
| Jobs reativados sempre como pending | `ON CONFLICT` reativa mesmo jobs completed |
