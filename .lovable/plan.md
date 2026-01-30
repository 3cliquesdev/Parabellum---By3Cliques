

# Plano: Corrigir Distribuição para Departamento Exato (Sem Fallback)

## Diagnóstico Confirmado

### Estado Real dos Agentes

| Agente | Departamento | Status | Chats |
|--------|--------------|--------|-------|
| **Miguel Fedes** | **Suporte Sistema** | ✅ Online | 7 |
| Camila de Farias | Suporte (pai) | ✅ Online | 31 |
| Juliana Alves | Suporte Pedidos | ✅ Online | 12 |

### Estrutura Hierárquica

```text
Suporte (36ce66cd)             → Camila de Farias
├── Suporte Pedidos (2dd0ee5c) → Juliana Alves, Oliveira
└── Suporte Sistema (fd4fcc90) → Miguel Fedes ✅
```

### Problema Identificado

O sistema implementa **fallback hierárquico automático**:
1. Conversa chega em "Suporte Sistema"
2. Miguel não estava online no momento do dispatch
3. Sistema fez fallback para "Suporte" (pai)
4. Encontrou Camila → Atribuiu a ela **INCORRETAMENTE**

### Comportamento Desejado

- Conversa de "Suporte Sistema" → **SOMENTE** Miguel (ou outros agentes do mesmo departamento)
- Conversa de "Suporte Pedidos" → **SOMENTE** Juliana/Oliveira
- Conversa de "Suporte" (geral) → **SOMENTE** Camila

**Se não houver agente disponível no departamento específico, a conversa deve aguardar na fila até que alguém fique online.**

## Solução

### Correção 1: Desabilitar Fallback Hierárquico na Edge Function

Modificar `dispatch-conversations/index.ts` para não fazer fallback para departamento pai:

```typescript
// ANTES (com fallback):
if (dept?.parent_id) {
  return findEligibleAgent(supabase, dept.parent_id, attemptedDepts);
}

// DEPOIS (sem fallback - distribuição estrita):
if (dept?.parent_id) {
  console.log(`[findEligibleAgent] No agents in ${dept.name}, strict mode - waiting for specific dept agents`);
  // NÃO faz fallback - conversa aguarda na fila
}
return null;
```

### Correção 2: Desatribuir Conversas Incorretas da Camila

As 39 conversas de "Suporte Sistema" que foram para Camila precisam ser corrigidas:

```sql
-- Desatribuir conversas de Suporte Sistema da Camila
UPDATE conversations
SET 
  assigned_to = NULL,
  ai_mode = 'waiting_human',
  dispatch_status = 'pending'
WHERE department = 'fd4fcc90-22e4-4127-ae23-9c9ecb6654b4'
  AND assigned_to = 'de03d434-9e8c-466b-b7a8-9a08bbef1760'
  AND status = 'open';
```

### Correção 3: Recriar Jobs de Dispatch para Miguel Receber

```sql
-- Deletar jobs escalados antigos
DELETE FROM conversation_dispatch_jobs
WHERE department_id = 'fd4fcc90-22e4-4127-ae23-9c9ecb6654b4'
  AND status = 'escalated';

-- Criar novos jobs pendentes
INSERT INTO conversation_dispatch_jobs (
  id, conversation_id, department_id, priority, status,
  attempts, max_attempts, next_attempt_at, created_at
)
SELECT 
  gen_random_uuid(), c.id, c.department, 1, 'pending',
  0, 5, NOW(), NOW()
FROM conversations c
WHERE c.department = 'fd4fcc90-22e4-4127-ae23-9c9ecb6654b4'
  AND c.status = 'open'
  AND c.ai_mode = 'waiting_human'
  AND c.assigned_to IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM conversation_dispatch_jobs cdj 
    WHERE cdj.conversation_id = c.id AND cdj.status = 'pending'
  );
```

### Correção 4: Disparar o Dispatcher

Chamar a Edge Function para processar os novos jobs e atribuir ao Miguel.

## Impacto Esperado

| Métrica | Antes | Depois |
|---------|-------|--------|
| Conversas de Suporte Sistema para Camila | 39 | 0 |
| Conversas de Suporte Sistema para Miguel | 7 | 39+ |
| Fallback hierárquico | Ativo | Desabilitado |
| Distribuição | Por hierarquia | Por departamento exato |

## Arquivos a Modificar

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `supabase/functions/dispatch-conversations/index.ts` | Edge Function | Remover fallback hierárquico |
| Migration SQL | Banco de Dados | Desatribuir e recriar jobs |

---

## Seção Técnica

### Mudança no Código da Edge Function

Localização: `supabase/functions/dispatch-conversations/index.ts`

**Função `findEligibleAgent` (linhas 375-395):**

```typescript
// ANTES:
if (dept?.parent_id) {
  console.log(`[findEligibleAgent] 🔄 Fallback: ${dept.name || departmentId} → parent ${dept.parent_id}`);
  return findEligibleAgent(supabase, dept.parent_id, attemptedDepts);
}

// DEPOIS:
if (dept?.parent_id) {
  console.log(`[findEligibleAgent] ℹ️ No agents available in ${dept.name}. Strict mode: no fallback to parent.`);
  // Distribuição estrita por departamento - não faz fallback
}
return null;
```

**Função `checkDepartmentHasAgents` (linhas 500-530) - também precisa ajustar:**

```typescript
// ANTES:
if (dept?.parent_id) {
  return checkDepartmentHasAgents(supabase, dept.parent_id, attemptedDepts);
}

// DEPOIS:
// Verificar apenas o departamento específico, sem fallback
return count > 0;
```

### SQL Completo para Execução

```sql
-- Passo 1: Desatribuir conversas incorretas da Camila
UPDATE conversations
SET 
  assigned_to = NULL,
  ai_mode = 'waiting_human'::ai_mode,
  dispatch_status = 'pending'
WHERE department = 'fd4fcc90-22e4-4127-ae23-9c9ecb6654b4'
  AND assigned_to = 'de03d434-9e8c-466b-b7a8-9a08bbef1760'
  AND status = 'open';

-- Passo 2: Deletar jobs escalados antigos
DELETE FROM conversation_dispatch_jobs
WHERE department_id = 'fd4fcc90-22e4-4127-ae23-9c9ecb6654b4'
  AND status IN ('escalated', 'completed');

-- Passo 3: Criar novos jobs pendentes
INSERT INTO conversation_dispatch_jobs (
  id, conversation_id, department_id, priority, status,
  attempts, max_attempts, next_attempt_at, created_at
)
SELECT 
  gen_random_uuid(), c.id, c.department, 1, 'pending',
  0, 5, NOW(), NOW()
FROM conversations c
WHERE c.department = 'fd4fcc90-22e4-4127-ae23-9c9ecb6654b4'
  AND c.status = 'open'
  AND c.ai_mode = 'waiting_human'
  AND c.assigned_to IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM conversation_dispatch_jobs cdj 
    WHERE cdj.conversation_id = c.id AND cdj.status = 'pending'
  );
```

### Verificação Pós-Deploy

1. Executar migration SQL
2. Deploy da Edge Function
3. Chamar `dispatch-conversations` manualmente
4. Verificar logs: "✅ Assigned ... to Miguel Fedes"
5. Confirmar que conversas foram atribuídas ao Miguel
6. Testar nova conversa de "Suporte Sistema" → Deve ir para Miguel

