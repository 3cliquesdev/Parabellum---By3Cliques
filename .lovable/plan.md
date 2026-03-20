

# Auto-criação de ticket para cancelamento

## Problema
Quando a IA detecta intenção de cancelamento e faz o handoff, **nenhum ticket é criado automaticamente**. Hoje, apenas o fluxo financeiro em anti-loop cria ticket automático (linhas 10329-10357 de `ai-autopilot-chat`).

## Solução
Estender a lógica de auto-ticket para cobrir cancelamentos em dois pontos:

### 1. `ai-autopilot-chat/index.ts` — Anti-loop (paridade com financeiro)
Na seção de anti-loop (linha ~10333), adicionar detecção de nó de cancelamento:
```typescript
const isCancellationNode = (flow_context.node_id || '').toLowerCase().includes('cancel') ||
  (collectedData.assunto || '').toLowerCase().includes('cancel') ||
  (collectedData.ai_exit_intent === 'cancelamento');

if (isFinancialNode || isCancellationNode) {
  const category = isCancellationNode ? 'cancelamento' : 'financeiro';
  const ticketSubject = isCancellationNode
    ? `[Auto] Solicitação de cancelamento - ${contact.first_name} ${contact.last_name}`
    : `[Auto] Solicitação financeira - ${contact.first_name} ${contact.last_name}`;
  // ... resto igual, com category dinâmico
}
```

### 2. `process-chat-flow/index.ts` — Exit por intenção de cancelamento
Na seção onde `cancellationIntentMatch` dispara o exit (linha ~3626), adicionar criação automática de ticket:
```typescript
if (cancellationIntentMatch) {
  // ... log ai_blocked_cancellation existente ...
  
  // Auto-criar ticket de cancelamento
  try {
    await createFlowTicket({
      subject: `[Auto] Cancelamento - conversa ${conversationId.substring(0,8)}`,
      description: `Intenção de cancelamento detectada.\nMensagem: ${(userMessage || '').substring(0, 200)}`,
      priority: 'high',
      category: 'cancelamento',
      conversationId,
      nodeId: currentNode.id,
      departmentId: depts.INTENT_MAP?.cancelamento || null,
    });
  } catch (e) { console.error('Auto-ticket cancelamento failed:', e); }
}
```

### Arquivos alterados

| Arquivo | Alteração |
|---|---|
| `supabase/functions/ai-autopilot-chat/index.ts` | Auto-ticket cancelamento no anti-loop |
| `supabase/functions/process-chat-flow/index.ts` | Auto-ticket no exit por `cancellationIntentMatch` |

Deploy: `ai-autopilot-chat`, `process-chat-flow`

