
## Plano: Corrigir Distribuicao Automatica da IA por Departamento

### Problema Identificado

A IA esta identificando corretamente os departamentos nos logs:
```
department: "suporte_n1"
department: "logistica"
```

Mas as conversas estao sendo distribuidas para agentes de **Suporte** mesmo quando deveriam ir para **Comercial** ou outros departamentos.

### Causas Raiz

1. **Parametro department_id e ignorado pelo route-conversation**
   - O `ai-autopilot-chat` envia `department_id: confidenceResult.department` (ex: "logistica", "comercial")
   - Mas o `route-conversation` espera `aiAnalysis.category` na interface
   - O `department_id` enviado **nunca e processado**

2. **Conversa nao e atualizada com departamento antes do roteamento**
   - O campo `conversations.department` permanece `null`
   - O `route-conversation` le `conversation.department` como `null` e distribui genericamente

3. **O route-conversation so busca `support_agent`**
   - Nas linhas 139-142 e 212-215, busca apenas role `support_agent`
   - Nunca considera `sales_rep` para conversas do Comercial
   - Nunca considera `financial_agent` para conversas Financeiras

4. **Mapeamento incompleto de departamentos**
   - O `pickDepartment()` retorna slugs como "comercial", "logistica", "suporte_n1"
   - Mas a tabela `departments` usa nomes como "Comercial", "Suporte", "Financeiro"
   - Nao ha conversao de slug para UUID de departamento

### Dados do Banco

| Departamento | UUID | Agents |
|--------------|------|--------|
| Comercial | f446e202-bdc3-4bb3-aeda-8c0aa04ee53c | 4 sales_rep |
| Suporte | 36ce66cd-7414-4fc8-bd4a-268fecc3f01a | 11 support_agent |
| Financeiro | af3c75a9-2e3f-49f1-8e0b-7fb3f4b5ee45 | 3 financial_agent + 1 support_agent |
| Operacional | fcba332e-d8d6-4db3-acc1-8b5fab6941be | 4 support_agent |

### Solucao Proposta

#### 1. Atualizar Interface do route-conversation

Adicionar `department_id` como parametro aceito:

```typescript
interface RouteConversationRequest {
  conversationId: string;
  priority?: number;
  department_id?: string;  // Slug ou UUID do departamento
  aiAnalysis?: {
    category?: string;
    intent?: string;
  };
}
```

#### 2. Criar Mapeamento Slug para Departamento

No `route-conversation`, adicionar mapeamento de slugs para nomes de departamento:

```typescript
const DEPARTMENT_SLUG_MAPPING: Record<string, string> = {
  'comercial': 'Comercial',
  'vendas': 'Comercial',
  'suporte_n1': 'Suporte',
  'suporte': 'Suporte',
  'tecnico': 'Suporte',
  'financeiro': 'Financeiro',
  'logistica': 'Operacional',
  'operacional': 'Operacional'
};
```

#### 3. Atualizar Conversa com Departamento Antes de Rotear

Quando `department_id` for recebido:
1. Resolver o slug para nome de departamento
2. Buscar UUID do departamento no banco
3. Atualizar `conversations.department` ANTES de buscar agentes

```typescript
// Resolver departamento recebido
if (department_id) {
  const deptName = DEPARTMENT_SLUG_MAPPING[department_id.toLowerCase()] || department_id;
  
  const { data: dept } = await supabase
    .from('departments')
    .select('id')
    .ilike('name', deptName)
    .maybeSingle();
  
  if (dept) {
    await supabase
      .from('conversations')
      .update({ department: dept.id })
      .eq('id', conversationId);
    
    conversation.department = dept.id;
  }
}
```

#### 4. Buscar Agentes por Departamento e Role Correspondente

Criar mapeamento de departamento para roles permitidos:

```typescript
const DEPARTMENT_ROLE_MAPPING: Record<string, string[]> = {
  'Comercial': ['sales_rep'],
  'Vendas': ['sales_rep'],
  'Suporte': ['support_agent'],
  'Suporte Pedidos': ['support_agent'],
  'Suporte Sistema': ['support_agent'],
  'Financeiro': ['financial_agent', 'support_agent'],
  'Operacional': ['support_agent'],
  'Customer Success': ['support_agent']
};
```

E modificar a query de agentes para considerar o role correto:

```typescript
// Determinar roles permitidos para o departamento
const departmentName = await getDepartmentName(conversation.department);
const allowedRoles = DEPARTMENT_ROLE_MAPPING[departmentName] || ['support_agent'];

// Buscar agentes com os roles corretos
const { data: agentIds } = await supabase
  .from('user_roles')
  .select('user_id')
  .in('role', allowedRoles);
```

### Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `supabase/functions/route-conversation/index.ts` | 1. Aceitar `department_id` no request 2. Criar mapeamentos 3. Atualizar conversa 4. Buscar agentes por role correto |

### Fluxo Corrigido

```text
ai-autopilot-chat                     route-conversation
      |                                      |
      | department_id: "comercial"           |
      |------------------------------------->|
      |                                      |
      |                          1. Mapear "comercial" -> "Comercial"
      |                          2. Buscar UUID do dept "Comercial"
      |                          3. UPDATE conversations SET department = UUID
      |                          4. Buscar roles para "Comercial" -> ['sales_rep']
      |                          5. Buscar agentes online com role 'sales_rep'
      |                          6. Load balance e atribuir
      |                                      |
      |<-------------------------------------|
      | assigned_to: Thaynara (sales_rep)    |
```

### Resultado Esperado

- Conversas com keywords de vendas irao para `sales_rep` do Comercial
- Conversas com keywords de suporte irao para `support_agent` do Suporte
- Conversas com keywords financeiras irao para `financial_agent` do Financeiro
- O campo `conversations.department` sera preenchido corretamente
- Thaynara (sales_rep) so recebera conversas do Comercial automaticamente

### Secao Tecnica

**Codigo Principal da Correcao:**

```typescript
// NOVO: Mapeamentos
const DEPARTMENT_SLUG_MAPPING: Record<string, string> = {
  'comercial': 'Comercial',
  'vendas': 'Comercial',
  'suporte_n1': 'Suporte',
  'suporte': 'Suporte',
  'tecnico': 'Suporte',
  'financeiro': 'Financeiro',
  'logistica': 'Operacional'
};

const DEPARTMENT_ROLE_MAPPING: Record<string, string[]> = {
  'Comercial': ['sales_rep'],
  'Suporte': ['support_agent'],
  'Financeiro': ['financial_agent', 'support_agent'],
  'Operacional': ['support_agent']
};

// No inicio do handler:
const { conversationId, priority = 0, department_id, aiAnalysis } = await req.json();

// NOVO: Resolver e atualizar departamento
if (department_id && !conversation.department) {
  const deptName = DEPARTMENT_SLUG_MAPPING[department_id.toLowerCase()];
  if (deptName) {
    const { data: dept } = await supabase
      .from('departments')
      .select('id, name')
      .ilike('name', deptName)
      .maybeSingle();
    
    if (dept) {
      await supabase
        .from('conversations')
        .update({ department: dept.id })
        .eq('id', conversationId);
      
      conversation.department = dept.id;
      conversation.departmentName = dept.name;
    }
  }
}

// NOVO: Buscar agentes com role correto
const deptName = conversation.departmentName || 'Suporte';
const allowedRoles = DEPARTMENT_ROLE_MAPPING[deptName] || ['support_agent'];

const { data: agentIds } = await supabase
  .from('user_roles')
  .select('user_id')
  .in('role', allowedRoles);
```
