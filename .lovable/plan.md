
# 6 Correções Cirúrgicas no process-chat-flow — CONCLUÍDO (10/03/2026)

## Arquivo: `supabase/functions/process-chat-flow/index.ts`

### FIX 1 ✅ — Proteção contra loop flow-to-flow
- Linhas ~2701 e ~2921: Guard `target_flow_id === activeState.flow_id` antes de fetch recursivo
- Cancela estado e retorna `flow_to_flow_loop_detected`

### FIX 2 ✅ — condition_v2 reconhecido como waiting_input
- 4 locais: status agora inclui `node.type === 'condition_v2'`
- Também corrigido o `if (startNode.type === 'condition')` para incluir `condition_v2`

### FIX 3 ✅ — Auto-traverse cobre condition_v2
- 3 while loops (OTP, fetch_order, validate_customer) agora incluem `'condition_v2'`
- `if` interno também cobre `condition_v2`

### FIX 4 ✅ — Transfer node atualiza conversations.department
- 2 locais de transfer (direto e msg chain): atualiza `ai_mode`, `assigned_to`, `department`
- Warn log quando `department_id` está vazio

### FIX 5 ✅ — startMessage com replaceVariables
- Carrega conversation + contact no escopo do trigger-matched flow
- Usa `buildVariablesContext` + `replaceVariables` para substituir variáveis

### FIX 6 ✅ — financialIntentPattern simplificado
- Regex com lookbehind complexo substituída por dois patterns: `financialPositive` + `financialContext`
- Elimina risco de incompatibilidade de runtime
