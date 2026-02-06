

# Plano: Corrigir Playbook - Traversal por Grafo + Placeholder

## Problema Identificado

O código atual (linhas 196-204) percorre o array `nodes` **sequencialmente** e para no primeiro `condition`/`switch`. Isso causa `visualNodes = []` quando o playbook tem estrutura:
```
email → delay → email → condition → ... → form
```

**Resultado:** Zero `customer_journey_steps` criados → UI trava em "Preparando seu onboarding..."

## Schema Confirmado (`customer_journey_steps`)

| Coluna | Tipo | Nullable |
|--------|------|----------|
| `id` | uuid | NO |
| `contact_id` | uuid | NO |
| `step_name` | text | NO |
| `step_type` | text | YES |
| `position` | integer | NO |
| `completed` | boolean | NO |
| `form_id` | uuid | YES |
| `video_url` | text | YES |
| `rich_content` | text | YES |
| `attachments` | jsonb | YES |
| `quiz_*` | (vários) | YES |

## Implementação

### Arquivo: `supabase/functions/public-start-playbook/index.ts`

### 1. Atualizar Interface de Edge (linha ~29)

```typescript
interface PlaybookEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}

interface PlaybookFlow {
  nodes: PlaybookNode[];
  edges: PlaybookEdge[];
}
```

### 2. Adicionar Funções de Traversal (após interfaces, antes do Deno.serve)

```typescript
// Funções auxiliares para traversal por grafo
function getOutgoingEdges(edges: PlaybookEdge[], sourceId: string): PlaybookEdge[] {
  return edges.filter(e => e.source === sourceId);
}

function getNodeById(nodes: PlaybookNode[], id: string): PlaybookNode | null {
  return nodes.find(n => n.id === id) || null;
}

function pickDefaultEdge(outgoing: PlaybookEdge[]): PlaybookEdge | null {
  if (!outgoing.length) return null;
  
  const byHandle = (h: string) => outgoing.find(e => e.sourceHandle === h) || null;
  
  return (
    byHandle("default") ||
    byHandle("true") ||
    outgoing.find(e => e.sourceHandle == null || e.sourceHandle === "") ||
    outgoing[0]
  );
}

function findStartNode(nodes: PlaybookNode[], edges: PlaybookEdge[]): PlaybookNode | null {
  const incomingTargets = new Set(edges.map(e => e.target));
  const candidates = nodes.filter(n => !incomingTargets.has(n.id));
  
  if (candidates.length > 1) {
    console.warn("[public-start-playbook] Multiple start nodes found:", candidates.map(c => c.id));
  }
  
  return candidates[0] || null;
}

function collectVisualNodes(nodes: PlaybookNode[], edges: PlaybookEdge[]): PlaybookNode[] {
  const visual: PlaybookNode[] = [];
  const visited = new Set<string>();
  
  let current = findStartNode(nodes, edges);
  let safety = 0;
  
  while (current && !visited.has(current.id) && safety < 200) {
    visited.add(current.id);
    
    // Adicionar forms e tasks como steps visuais
    if (current.type === "task" || current.type === "form") {
      visual.push(current);
    }
    
    const outgoing = getOutgoingEdges(edges, current.id);
    if (!outgoing.length) break;
    
    // Para conditions/switch: seguir a edge default
    const chosen = (current.type === "condition" || current.type === "switch")
      ? pickDefaultEdge(outgoing)
      : outgoing[0];
    
    if (!chosen) break;
    
    current = getNodeById(nodes, chosen.target);
    safety++;
  }
  
  if (safety >= 200) {
    console.warn("[public-start-playbook] Safety stop reached (possible loop).");
  }
  
  return visual;
}
```

### 3. Atualizar Parsing do Flow (linha ~146)

```typescript
const flow = playbook.flow_definition as PlaybookFlow;
const nodes = flow?.nodes || [];
const edges = flow?.edges || [];  // ADICIONAR

if (nodes.length === 0) {
  // ... existing code
}
```

### 4. Substituir Loop Antigo por Traversal (linhas 195-204)

**ANTES (quebrado):**
```typescript
const visualNodes: PlaybookNode[] = [];
for (const node of nodes) {
  if (node.type === 'switch' || node.type === 'condition') {
    break;
  }
  if (node.type === 'task' || node.type === 'form') {
    visualNodes.push(node);
  }
}
```

**DEPOIS (traversal por grafo + placeholder):**
```typescript
// Coletar nodes visuais percorrendo o grafo
const visualNodes = collectVisualNodes(nodes, edges);

// Fallback: se não houver forms/tasks, criar step placeholder
// (evita UI travada em "Preparando seu onboarding...")
const effectiveNodes: PlaybookNode[] = visualNodes.length > 0 
  ? visualNodes 
  : [{
      id: 'placeholder-auto',
      type: 'placeholder',
      data: { label: 'Acompanhamento Automático' }
    }];

console.log(`[public-start-playbook] Creating ${effectiveNodes.length} journey steps (${visualNodes.length} from flow, placeholder: ${visualNodes.length === 0})`);
```

### 5. Atualizar Loop de Criação de Steps (linhas 208-248)

```typescript
for (let i = 0; i < effectiveNodes.length; i++) {
  const node = effectiveNodes[i];
  const nodeData = node.data || {};

  const stepData: Record<string, any> = {
    contact_id: contact.id,
    step_name: nodeData.label || `Etapa ${i + 1}`,
    position: i + 1,
    step_type: node.type, // 'task', 'form', or 'placeholder'
    completed: node.type === 'placeholder' ? false : false, // placeholder pode ser auto-completed se preferir
  };

  // Add task-specific fields
  if (node.type === 'task') {
    stepData.is_critical = nodeData.quiz_enabled || false;
    stepData.video_url = nodeData.video_url || null;
    stepData.rich_content = nodeData.rich_content || null;
    stepData.attachments = nodeData.attachments || null;
    stepData.quiz_enabled = nodeData.quiz_enabled || false;
    stepData.quiz_question = nodeData.quiz_question || null;
    stepData.quiz_options = nodeData.quiz_options || null;
    stepData.quiz_correct_option = nodeData.quiz_correct_option || null;
    stepData.quiz_passed = false;
  }

  // Add form-specific fields
  if (node.type === 'form') {
    stepData.form_id = nodeData.form_id || null;
    stepData.is_critical = true;
  }

  // Placeholder steps are not critical (just informative)
  if (node.type === 'placeholder') {
    stepData.is_critical = false;
    stepData.notes = 'Este onboarding é composto apenas por automações (ex.: e-mails).';
  }

  const { error: stepError } = await supabaseClient
    .from('customer_journey_steps')
    .insert(stepData);

  if (stepError) {
    console.error(`Failed to create journey step ${i + 1}:`, stepError);
  } else {
    console.log(`[public-start-playbook] Created journey step: ${nodeData.label} (type: ${node.type})`);
  }
}
```

---

## Resumo das Mudanças

| Seção | Mudança |
|-------|---------|
| **Interfaces** | Adicionar `PlaybookEdge` com `sourceHandle` |
| **Funções** | `findStartNode`, `collectVisualNodes`, `pickDefaultEdge`, etc. |
| **Parsing** | Extrair `edges` do `flow_definition` |
| **Lógica** | Substituir loop sequencial por traversal de grafo |
| **Fallback** | Criar step placeholder se `visualNodes === []` |

---

## Garantias Enterprise

| # | Garantia | Implementação |
|---|----------|---------------|
| 1 | Start node robusto | `findStartNode` com warning para múltiplos |
| 2 | Condition atravessada | `pickDefaultEdge` com prioridade (default → true → first) |
| 3 | Múltiplas saídas | `getOutgoingEdges` + escolha inteligente |
| 4 | Idempotência | Já existe: delete antigo + insert novo (linhas 181-191) |
| 5 | Loop infinito | Safety counter (200 iterações max) |
| 6 | Fallback UI | Placeholder step quando `visualNodes = []` |

---

## Testes Obrigatórios

| # | Cenário | Esperado |
|---|---------|----------|
| 1 | Playbook com condition antes de form | Form aparece como step |
| 2 | Playbook só com emails (sem forms/tasks) | Placeholder step criado |
| 3 | Playbook com tasks no início | Funciona como antes |
| 4 | Condition com 2 saídas (true/false) | Segue path default |
| 5 | Retry/reprocess | Não duplica steps (delete antes) |
| 6 | Grafo com loop acidental | Safety stop, não trava |

