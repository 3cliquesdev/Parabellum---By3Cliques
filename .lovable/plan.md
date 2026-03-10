

# 6 Correções Cirúrgicas no process-chat-flow

## Arquivo: `supabase/functions/process-chat-flow/index.ts` (3722 linhas)

Todas as alterações confirmadas após inspeção do código atual.

---

### FIX 1 — Proteção contra loop flow-to-flow (linhas 2700-2722 e 2920-2944)

Dois locais fazem `fetch` recursivo para `process-chat-flow` com `target_flow_id`. Adicionar guard antes de cada `fetch`:

```typescript
if (nextNode.data.target_flow_id === activeState.flow_id) {
  console.error('[process-chat-flow] ⚠️ LOOP DETECTADO: flow-to-flow aponta para o mesmo fluxo.');
  await supabaseClient.from('chat_flow_states').update({
    status: 'cancelled', completed_at: new Date().toISOString()
  }).eq('id', activeState.id);
  return new Response(JSON.stringify({
    useAI: false, transfer: false, error: 'flow_to_flow_loop_detected'
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

Inserir antes da linha 2708 (1o local) e antes da linha 2936 (2o local).

---

### FIX 2 — condition_v2 reconhecido como waiting_input (4 locais)

Atualmente `node.type === 'condition'` em 4 locais precisa incluir `condition_v2`:

| Linha | Contexto |
|-------|----------|
| 3404 | Master Flow UPDATE de estado existente |
| 3416 | Master Flow INSERT de novo estado |
| 3638 | Trigger-matched flow INSERT de estado |
| 2974 | nextStatus após auto-advance (já inclui `condition` mas não `condition_v2`) |

Substituir por: `(node.type === 'condition' || node.type === 'condition_v2')`

---

### FIX 3 — Auto-traverse cobre condition_v2 (3 locais)

Linhas 1596, 2413, 2549: while loops com `['condition', 'input', 'start']` não incluem `condition_v2`.

Substituir por: `['condition', 'condition_v2', 'input', 'start']`

Também ajustar os `if (afterNode.type === 'condition')` dentro desses loops para `(... === 'condition' || ... === 'condition_v2')`.

---

### FIX 4 — Transfer node atualiza conversations.department (linha ~2732)

Após o `chat_flow_states.update({ status: 'transferred' })` na linha 2732, antes do `return new Response(...)` na linha 2734, adicionar:

```typescript
const transferDeptId = nextNode.data?.department_id || null;
const transferAiMode = nextNode.data?.ai_mode || 'waiting_human';
const convUpdatePayload: any = { ai_mode: transferAiMode, assigned_to: null };
if (transferDeptId) convUpdatePayload.department = transferDeptId;
await supabaseClient.from('conversations').update(convUpdatePayload).eq('id', conversationId);
if (!transferDeptId) {
  console.warn('[process-chat-flow] ⚠️ Transfer node sem department_id');
}
```

Fazer o mesmo para o segundo transfer (após a cadeia de mensagens, ~linha 2960).

---

### FIX 5 — startMessage com replaceVariables (linha 3697)

No escopo do trigger-matched flow (após linha 3695), `contactData` e `conversation` NÃO existem. Precisam ser carregados:

```typescript
// Carregar dados para variáveis
const { data: trigConv } = await supabaseClient
  .from('conversations')
  .select('id, contact_id, channel, status, priority, protocol_number, created_at')
  .eq('id', conversationId).maybeSingle();
let trigContactData: any = null;
if (trigConv?.contact_id) {
  const { data: ct } = await supabaseClient
    .from('contacts').select('*').eq('id', trigConv.contact_id).maybeSingle();
  trigContactData = ct;
  enrichContactIsCustomer(trigContactData);
}
const trigVarCtx = await buildVariablesContext({}, trigContactData, trigConv, supabaseClient);
const startMessage = replaceVariables(startNode.data?.message || "", trigVarCtx);
```

---

### FIX 6 — financialIntentPattern simplificado (linha 2064)

Substituir o regex com lookbehind complexo por dois patterns separados:

```typescript
const financialPositive = /saque|sacar|reembolso|estorno|cancelar.*assinatura|meu dinheiro|ressarcimento|pix|saldo|retirar|retirada|devolv[eê]r?|devolu[çc][ãa]o/i;
const financialContext = /endere[çc]o\s+de|local\s+de\s+entrega|forma\s+de\s+pagamento/i;
const financialIntentMatch =
  (forceFinancialExit && forbidFinancial) ||
  (forbidFinancial && msgLower.length > 0 && financialPositive.test(userMessage || '') && !financialContext.test(userMessage || ''));
```

---

## Resumo de locais editados

| Fix | Linhas | Tipo |
|-----|--------|------|
| 1 | ~2707, ~2935 | Inserção (guard) |
| 2 | 2974, 3404, 3416, 3638 | Substituição |
| 3 | 1596, 2413, 2549 | Substituição |
| 4 | ~2733, ~2960 | Inserção |
| 5 | 3697 | Substituição + inserção |
| 6 | 2064-2065 | Substituição |

Deploy automático após push (edge function).

