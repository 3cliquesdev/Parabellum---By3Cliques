
# Plano: Reativação Automática de Conversas Escaladas quando Agente Volta Online

## Diagnóstico

**Problema confirmado**: O atendente Miguel Fedes está **online** no departamento "Suporte Sistema", mas existem **22 conversas "escalated"** que não estão sendo distribuídas para ele.

### Causa Raiz

1. Quando um agente fica **offline/ausente/ocupado**, os jobs de distribuição tentam várias vezes
2. Após atingir `max_attempts` (padrão: 5), o job é marcado como **"escalated"**
3. Quando o agente **volta para online**, o dispatcher é chamado
4. **BUG**: O dispatcher só processa jobs com `status = 'pending'`, **ignorando completamente os escalated**

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   FLUXO ATUAL (COM BUG)                                 │
├────────────────────────────────────────────────────────────────────────┤
│  1. Conversa entra na fila                                              │
│  2. Job criado com status='pending'                                     │
│  3. Dispatcher tenta atribuir → nenhum agente online                    │
│  4. Após 5 tentativas → status='escalated'                              │
│  5. Agente volta ONLINE → dispatcher chamado                            │
│  6. ❌ Query só busca status='pending' → conversas escalated IGNORADAS  │
│  7. ❌ Miguel online mas sem receber conversas                          │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Solução Proposta

Implementar **re-enfileiramento automático** de conversas escaladas quando:
1. Um agente muda seu status para `online`
2. O dispatcher é executado e há agentes disponíveis no departamento

### Arquitetura

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   FLUXO CORRIGIDO                                       │
├────────────────────────────────────────────────────────────────────────┤
│  1. Agente muda status para ONLINE                                      │
│  2. Frontend chama dispatcher com { agent_id, department_id }           │
│  3. Dispatcher detecta agente online em dept X                          │
│  4. ✅ NOVO: Re-enfileira jobs escalados do dept X                      │
│  5. ✅ Processa todos os jobs (incluindo os re-enfileirados)            │
│  6. ✅ Miguel recebe conversas imediatamente                            │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Mudanças Técnicas

### 1. Modificar `dispatch-conversations/index.ts`

Adicionar função `requeueEscalatedJobs` que:

- Busca departamentos com agentes online e capacidade disponível
- Identifica jobs `escalated` desses departamentos
- Reseta o status para `pending` e `attempts` para 0
- Atualiza `dispatch_status` nas conversas correspondentes

```typescript
async function requeueEscalatedJobs(supabase, agentDepartmentId?: string) {
  // Se recebeu department_id específico (agente acabou de ficar online)
  // prioriza esse departamento
  const targetDepts = agentDepartmentId ? [agentDepartmentId] : await getDeptsWithOnlineAgents(supabase);
  
  for (const deptId of targetDepts) {
    // Verificar se há agentes online com capacidade
    const hasCapacity = await checkDepartmentHasAvailableCapacity(supabase, deptId);
    if (!hasCapacity) continue;
    
    // Re-enfileirar jobs escalados deste departamento
    const { data: requeued } = await supabase
      .from('conversation_dispatch_jobs')
      .update({ 
        status: 'pending', 
        attempts: 0,
        next_attempt_at: new Date().toISOString(),
        last_error: 'requeued_agent_online'
      })
      .eq('status', 'escalated')
      .eq('department_id', deptId)
      .select('conversation_id');
    
    // Atualizar status das conversas
    if (requeued?.length) {
      await supabase
        .from('conversations')
        .update({ dispatch_status: 'pending' })
        .in('id', requeued.map(j => j.conversation_id));
    }
  }
}
```

### 2. Chamar no início do dispatch cycle

```typescript
serve(async (req) => {
  // ... existing code ...
  
  // Parse body para pegar department_id do agente que ficou online
  let agentDepartmentId: string | undefined;
  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}));
    agentDepartmentId = body.department_id;
  }
  
  // ✅ NOVO: Re-enfileirar jobs escalados antes de processar
  await requeueEscalatedJobs(supabase, agentDepartmentId);
  
  // ... continue with existing dispatch logic ...
});
```

### 3. Adicionar verificação de capacidade

```typescript
async function checkDepartmentHasAvailableCapacity(supabase, departmentId) {
  // Reutilizar lógica existente de findEligibleAgent
  // mas apenas verificar se EXISTE algum agente elegível
  const agent = await findEligibleAgent(supabase, departmentId);
  return agent !== null;
}
```

---

## Arquivos Afetados

| Arquivo | Ação |
|---------|------|
| `supabase/functions/dispatch-conversations/index.ts` | **Modificar** - Adicionar requeue de escalados |

---

## Regras Aplicadas (Base de Conhecimento)

- **Upgrade, não downgrade**: Melhoria que não quebra nada existente
- **Distribuição estrita por departamento**: Mantém regra de não fazer fallback entre departamentos
- **Capacidade mínima de 30**: Mantém regra existente
- **Trigger imediato ao ficar online**: Aproveita chamada existente do frontend

---

## Teste de Validação

Após implementação:

1. Marcar Miguel como "busy" ou "offline"
2. Aguardar conversas serem escaladas
3. Marcar Miguel como "online"
4. **Esperado**: Conversas escaladas devem ser distribuídas para ele em segundos

---

## Impacto

- **Zero regressão**: Código existente permanece intacto
- **Imediato**: Miguel receberá conversas assim que voltar online
- **Universal**: Regra aplicada para todos os agentes/departamentos
