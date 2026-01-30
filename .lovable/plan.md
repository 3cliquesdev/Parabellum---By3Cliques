
# Plano: Correções Críticas para Travessia de Fluxo (Versão Produção-Safe)

## Problema Atual
O código implementado anteriormente tem 4 vulnerabilidades que causam o comportamento "só transfere":

1. **Retorna `response: ""`** → webhook interpreta como "sem fluxo" e transfere
2. **Cria state duplicado** → comportamentos "fantasma" e loops
3. **Condition usa path fixo** → se handle do edge não for `true`/`false`, não encontra próximo nó
4. **Logs insuficientes** → difícil diagnosticar por que caiu em transfer

---

## 4 Correções a Aplicar

### 1. Nunca retornar `response: ""`
**Antes:**
```typescript
response: contentMessage
```

**Depois:**
```typescript
const msg = (contentMessage || '').trim();
response: msg.length ? msg : null  // ✅ null quando vazio
```

### 2. Não criar state duplicado (UPSERT)
**Antes:**
```typescript
// Sempre INSERT
const { data: newState } = await supabaseClient
  .from('chat_flow_states')
  .insert({...})
```

**Depois:**
```typescript
// Verificar se já existe
const { data: existingState } = await supabaseClient
  .from('chat_flow_states')
  .select('id')
  .eq('conversation_id', conversationId)
  .eq('flow_id', masterFlow.id)
  .in('status', ['active', 'waiting_input'])
  .maybeSingle();

if (existingState?.id) {
  // UPDATE existente
  await supabaseClient
    .from('chat_flow_states')
    .update({ current_node_id: node.id, collected_data: collectedData })
    .eq('id', existingState.id);
} else {
  // INSERT apenas se não existe
  const { data: newState } = await supabaseClient
    .from('chat_flow_states')
    .insert({...})
    .select('id')
    .single();
}
```

### 3. Condition com cascata de handles
**Antes:**
```typescript
path = conditionResult ? 'true' : 'false';
const nextNode = findNextNode(flowDef, contentNode, path);
```

**Depois:**
```typescript
// Tentar múltiplos handles (true/false, yes/no, 1/2)
const handles = conditionResult ? ['true', 'yes', '1'] : ['false', 'no', '2'];

let nextNode = null;
for (const h of handles) {
  nextNode = findNextNode(flowDef, node, h);
  if (nextNode) break;
}
```

### 4. Logs fortes para diagnóstico
```typescript
console.log('[process-chat-flow] 🔍 Condition evaluation:', {
  condition_type,
  condition_field,
  condition_value,
  fieldValue,
  contactId: contactData?.id
});

console.log('[process-chat-flow] 🔀 Trying handles:', handles.join(', '));
console.log('[process-chat-flow] ✓ Found next node via handle "X":', nextNode.type);
```

---

## Arquivo a Modificar

| Arquivo | Linhas | Ação |
|---------|--------|------|
| `supabase/functions/process-chat-flow/index.ts` | 879-1131 | Substituir bloco do Master Flow |

---

## Fluxo Corrigido

```text
Cliente envia "Bom dia" via WhatsApp
         │
         ▼
meta-whatsapp-webhook → process-chat-flow
         │
         ▼
Encontra startNode: "input"
         │
         ▼ [Travessia automática]
Atravessa: input → condition
         │
         ▼
Avalia condition (is_validated_customer)
Tenta handles: ['true', 'yes', '1'] ou ['false', 'no', '2']
         │
    ┌────┴────┐
    │         │
  true      false
    │         │
    ▼         ▼
ask_options transfer
    │
    ▼
Retorna response: "Olá! Como posso ajudar?" (ou null se vazio)
         │
         ▼
meta-whatsapp-webhook:
  - Se response não-null → envia via WhatsApp ✅
  - Se response=null + flowStarted=true → aguarda (não transfere automaticamente)
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| `response: ""` → webhook transfere | `response: null` + `flowStarted: true` → webhook sabe que fluxo está ativo |
| State duplicado → comportamento fantasma | UPSERT → um state por conversa/fluxo |
| Condition falha silenciosamente | Tenta 3 handles + logs detalhados |
| "Só transfere" | Segue o caminho correto do fluxo |

---

## Testes Obrigatórios

| Cenário | Resultado Esperado |
|---------|-------------------|
| Input → Condition(true) → ask_options | Retorna mensagem do ask_options |
| Input → Condition(false) → transfer | Retorna transfer com mensagem |
| Cliente já com state ativo | UPDATE, não INSERT duplicado |
| Condition sem handle compatível | Log de aviso, para no nó atual |
| Mensagem vazia | `response: null` (não `""`) |
