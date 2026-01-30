
# Plano: Implementar Fallback Hierárquico no Dispatcher

## Problema Identificado

O dispatcher de conversas está com política "Strict Department" que **não possui fallback** para departamentos pai, causando:

1. **20+ conversas órfãs** em "Suporte Sistema" (nenhum agente configurado)
2. **Miguel com apenas 5 chats** enquanto poderia atender mais
3. **Juliana com 12 chats** também subutilizada
4. **Camila em "Suporte" pai** com apenas 2 chats - potencial fallback

### Estrutura Atual

```text
Suporte (36ce66cd) - Camila: 2 chats, online ✅
├── Suporte Pedidos (2dd0ee5c) - Miguel: 5, Juliana: 12 ✅
└── Suporte Sistema (fd4fcc90) - NENHUM AGENTE ❌
    └── 20 conversas aguardando ⏳
```

### Comportamento Atual vs Esperado

| Cenário | Atual | Esperado |
|---------|-------|----------|
| Conversa em "Suporte Sistema" | ❌ Fica órfã (manual_only) | ✅ Fallback para "Suporte" pai |
| Agente no parent_id | Ignorado | Atende subdepartamentos |

## Solução

Implementar **fallback hierárquico** na função `findEligibleAgent`:

1. Tentar encontrar agente no departamento **EXATO** da conversa
2. Se não encontrar → buscar no **departamento PAI** (parent_id)
3. Se não encontrar → marcar como manual_only (comportamento atual)

### Fluxo Corrigido

```text
Conversa em "Suporte Sistema"
        ↓
findEligibleAgent(dept: "Suporte Sistema")
        ↓
Busca agentes online em "Suporte Sistema" → []
        ↓
Fallback: Buscar parent_id → "Suporte"
        ↓
Busca agentes online em "Suporte" → [Camila]
        ↓
Camila tem capacidade (2 < 30)? ✅
        ↓
Atribuir conversa para Camila ✅
```

## Mudanças Necessárias

### 1. Edge Function `dispatch-conversations/index.ts`

Modificar `findEligibleAgent` para:
- Aceitar parâmetro adicional `attemptedDepts` para evitar loops
- Buscar `parent_id` do departamento quando não encontrar agentes
- Recursivamente tentar no parent (máximo 2 níveis: subdept → dept pai)

### 2. Lógica de Fallback

```typescript
async function findEligibleAgent(supabase, departmentId, attemptedDepts = []) {
  // Evitar loops infinitos
  if (attemptedDepts.includes(departmentId)) return null;
  attemptedDepts.push(departmentId);
  
  // 1. Tentar departamento exato
  const agent = await searchInDepartment(supabase, departmentId);
  if (agent) return agent;
  
  // 2. Fallback para parent
  const { data: dept } = await supabase
    .from('departments')
    .select('parent_id')
    .eq('id', departmentId)
    .single();
  
  if (dept?.parent_id) {
    console.log(`[findEligibleAgent] Fallback to parent: ${dept.parent_id}`);
    return findEligibleAgent(supabase, dept.parent_id, attemptedDepts);
  }
  
  return null; // Nenhum agente encontrado em toda hierarquia
}
```

## Impacto Esperado

### Antes (Bug)

| Conversa em | Agente Encontrado | Resultado |
|-------------|-------------------|-----------|
| Suporte Sistema | ❌ Nenhum | manual_only (órfã) |
| Suporte Pedidos | ✅ Miguel/Juliana | assigned |

### Depois (Corrigido)

| Conversa em | Agente Encontrado | Fallback | Resultado |
|-------------|-------------------|----------|-----------|
| Suporte Sistema | ❌ Nenhum | → Suporte (Camila) | assigned ✅ |
| Suporte Pedidos | ✅ Miguel/Juliana | - | assigned ✅ |
| Financeiro | ❌ Nenhum | Sem parent | manual_only |

## Compatibilidade

- ✅ Mantém preferência por departamento exato
- ✅ Fallback é transparente para o agente (conversa aparece normalmente)
- ✅ Máximo 2 níveis de fallback (evita performance issues)
- ✅ Alinhado com memória `department-routing-fallback-logic`

## Arquivos a Modificar

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `supabase/functions/dispatch-conversations/index.ts` | Edge Function | Adicionar fallback hierárquico |

---

## Seção Técnica

### Código Completo da Modificação

```typescript
// ANTES (linha 319-421):
async function findEligibleAgent(supabase, departmentId) {
  // Busca APENAS no departamento exato
  console.log(`[findEligibleAgent] Searching ONLY in exact dept: ${departmentId}`);
  // ...
}

// DEPOIS:
async function findEligibleAgent(
  supabase: any,
  departmentId: string,
  attemptedDepts: string[] = []
): Promise<EligibleAgent | null> {
  
  // Evitar loops infinitos
  if (attemptedDepts.includes(departmentId)) {
    console.log(`[findEligibleAgent] Already tried dept ${departmentId}, stopping`);
    return null;
  }
  attemptedDepts.push(departmentId);
  
  const eligibleRoles = [
    'support_agent', 'sales_rep', 'cs_manager', 
    'support_manager', 'manager', 'general_manager', 'admin'
  ];

  const { data: eligibleUserRoles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', eligibleRoles);

  if (rolesError || !eligibleUserRoles?.length) {
    return null;
  }

  const eligibleUserIds = eligibleUserRoles.map((r) => r.user_id);

  console.log(`[findEligibleAgent] Searching in dept: ${departmentId}`);

  // Buscar agentes online no departamento
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, full_name, last_status_change')
    .eq('availability_status', 'online')
    .eq('is_blocked', false)
    .eq('department', departmentId)
    .in('id', eligibleUserIds);

  // Se encontrou agentes, processar normalmente
  if (!profilesError && profiles?.length) {
    // ... (código existente para calcular capacidade e retornar agente)
    const agent = await processAgentCapacity(supabase, profiles);
    if (agent) return agent;
  }

  // FALLBACK: Tentar departamento pai
  console.log(`[findEligibleAgent] No agents in ${departmentId}, trying parent...`);
  
  const { data: dept } = await supabase
    .from('departments')
    .select('parent_id')
    .eq('id', departmentId)
    .single();

  if (dept?.parent_id) {
    console.log(`[findEligibleAgent] Fallback to parent: ${dept.parent_id}`);
    return findEligibleAgent(supabase, dept.parent_id, attemptedDepts);
  }

  console.log(`[findEligibleAgent] No parent for ${departmentId}, no agents found`);
  return null;
}
```

### Atualização em `checkDepartmentHasAgents`

Também deve verificar hierarquia:

```typescript
async function checkDepartmentHasAgents(supabase, departmentId, attemptedDepts = []) {
  if (attemptedDepts.includes(departmentId)) return false;
  attemptedDepts.push(departmentId);
  
  // Verificar departamento exato
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('department', departmentId)
    .in('id', eligibleUserIds);

  if (count > 0) return true;
  
  // Verificar parent
  const { data: dept } = await supabase
    .from('departments')
    .select('parent_id')
    .eq('id', departmentId)
    .single();

  if (dept?.parent_id) {
    return checkDepartmentHasAgents(supabase, dept.parent_id, attemptedDepts);
  }
  
  return false;
}
```

### Log Esperado Após Correção

```text
[findEligibleAgent] Searching in dept: fd4fcc90 (Suporte Sistema)
[findEligibleAgent] No agents in fd4fcc90, trying parent...
[findEligibleAgent] Fallback to parent: 36ce66cd (Suporte)
[findEligibleAgent] Found 1 agents: [Camila]
[dispatch-conversations] ✅ Assigned xxx to Camila (150ms)
```
