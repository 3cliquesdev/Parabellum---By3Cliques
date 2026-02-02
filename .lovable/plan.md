
# Plano: Proteção contra Resposta Inválida em ask_options

## Problema
Quando o cliente envia uma resposta inválida (ex: "?", "Aguardando") em um nó `ask_options`, o sistema apresenta comportamento incorreto:
1. **IA responde** ao invés do fluxo → Mensagem "Sou um assistente virtual..."
2. **Fluxo reinicia** do Master Flow ao invés de permanecer no nó atual
3. **Estado perdido** quando a conversa já tem chat_flow_state ativo

## Solução

### Arquivo 1: `supabase/functions/process-chat-flow/index.ts`

#### Mudança 1A: Melhorar mensagem de retry (linhas 553-576)
Atualizar a mensagem de resposta inválida para ser mais humanizada e adicionar flag `preventAI`:

**DE:**
```typescript
return new Response(
  JSON.stringify({
    useAI: false,
    response: "❗ Não entendi sua resposta.\n\nPor favor, responda com o *número* ou *nome* de uma das opções:",
    options: formattedOptions,
    retry: true,
    flowId: activeState.flow_id,
    nodeId: currentNode.id,
    invalidOption: true,
  }),
```

**PARA:**
```typescript
// Log estruturado para auditoria
console.log('[process-chat-flow] invalidOption conv=' + conversationId + ' flow=' + activeState.flow_id + ' node=' + currentNode.id + ' msg="' + userMessage + '"');

return new Response(
  JSON.stringify({
    useAI: false,
    response: "Desculpe, não entendi sua resposta. 🙂\n\nPara que eu possa te ajudar, por favor responda com o *número* (1, 2, 3...) ou o *nome* de uma das opções abaixo:",
    options: formattedOptions,
    retry: true,
    flowId: activeState.flow_id,
    nodeId: currentNode.id,
    invalidOption: true,
    preventAI: true, // 🆕 Flag crítica: impede IA de responder
  }),
```

#### Mudança 1B: Prevenir reinício indevido do Master Flow (linhas 915-930)
Antes de iniciar o Master Flow quando não há trigger, verificar se existe estado ativo:

**INSERIR ANTES da linha 916** (`// 🆕 MASTER FLOW: Se não encontrou trigger`):
```typescript
// 🆕 PROTEÇÃO: Verificar se existe estado ativo ANTES de iniciar Master Flow
const { data: existingActiveFlowState } = await supabaseClient
  .from('chat_flow_states')
  .select('id, flow_id, current_node_id')
  .eq('conversation_id', conversationId)
  .eq('status', 'active')
  .maybeSingle();

if (existingActiveFlowState) {
  console.log('[process-chat-flow] ⚠️ Estado ativo encontrado - NÃO iniciar Master Flow');
  console.log('[process-chat-flow] Existing state:', existingActiveFlowState.id, 'flow:', existingActiveFlowState.flow_id, 'node:', existingActiveFlowState.current_node_id);
  
  // Mensagem genérica de retry para evitar perda de estado
  return new Response(
    JSON.stringify({
      useAI: false,
      response: "Desculpe, não entendi sua resposta. 🙂\n\nPor favor, verifique as opções acima e responda novamente.",
      retry: true,
      preventAI: true,
      flowId: existingActiveFlowState.flow_id,
      nodeId: existingActiveFlowState.current_node_id,
      invalidOption: true,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

### Arquivo 2: `supabase/functions/meta-whatsapp-webhook/index.ts`

#### Mudança 2A: Proteção contra IA em retry/invalidOption (linha 635)
Adicionar verificação explícita para `preventAI` e `invalidOption` antes de enviar resposta estática:

**DE (linha 635):**
```typescript
// CASO 2: Fluxo retornou resposta estática (Message/AskOptions/etc)
if (!flowData.useAI && flowData.response) {
```

**PARA:**
```typescript
// CASO 2: Fluxo retornou resposta estática (Message/AskOptions/etc)
// 🆕 INCLUI proteção para retry de opção inválida
if (!flowData.useAI && flowData.response) {
  // 🆕 Log de auditoria para retry de opção inválida
  if (flowData.retry && flowData.invalidOption) {
    console.log("[meta-whatsapp-webhook] 🔄 RETRY opção inválida - preventAI:", flowData.preventAI);
    console.log("[meta-whatsapp-webhook] 📋 Enviando APENAS resposta estática do fluxo");
  }
```

O código existente já faz `continue` após enviar a resposta (linha 688), o que impede que caia no fallback de IA. A mudança principal é apenas garantir o log e a documentação.

#### Mudança 2B: Verificação adicional após CASO 2 (antes do CASO 3)
Adicionar verificação explícita para garantir que `preventAI` bloqueia a IA:

**INSERIR após linha 688** (após o `continue` do CASO 2):
```typescript
// CASO 2.5: 🆕 preventAI=true sem response → Proteção adicional
if (flowData.preventAI === true) {
  console.log("[meta-whatsapp-webhook] 🛡️ preventAI ativo sem response - bloqueando IA");
  continue;
}
```

---

## Fluxo de Decisão Após Mudanças

```text
Cliente em ask_options
    ↓
Envia "?" (inválido)
    ↓
process-chat-flow detecta invalidOption
    ↓
Retorna: { useAI: false, response: "Desculpe...", preventAI: true, invalidOption: true }
    ↓
meta-whatsapp-webhook recebe
    ↓
CASO 2: !useAI && response → Envia mensagem + opções
    ↓
continue → NÃO cai no fallback de IA
    ↓
Cliente vê: "Desculpe, não entendi sua resposta. 🙂\n\n1️⃣ Pedidos\n2️⃣ Sistemas..."
```

---

## Critérios de Aceite

| # | Cenário | Esperado |
|---|---------|----------|
| 1 | ask_options → "?" | Retry humanizado + opções, mesmo nodeId |
| 2 | Após retry → "1" | Fluxo avança normalmente |
| 3 | retry/invalidOption | IA NUNCA é chamada |
| 4 | Estado ativo existe | Master Flow NÃO reinicia |

---

## Impacto

| Área | Impacto |
|------|---------|
| Fluxos | Corrigido - respostas inválidas não reiniciam fluxo |
| UX | Melhorado - mensagem mais amigável e clara |
| IA | Protegido - flag `preventAI` garante silêncio |
| Estados | Preservado - verificação antes do Master Flow |
| Regressão | Zero - alterações são adições/ajustes, não remoções |

---

## Seção Técnica: Resumo das Alterações

### process-chat-flow/index.ts
1. **Linha 555**: Adicionar log estruturado `invalidOption conv=... flow=... node=... msg="..."`
2. **Linhas 564-575**: Melhorar mensagem de retry + adicionar `preventAI: true`
3. **Linhas 915-930**: Inserir verificação de estado ativo antes de Master Flow

### meta-whatsapp-webhook/index.ts
1. **Linhas 635-639**: Adicionar log de auditoria para retry/invalidOption
2. **Linha 689**: Inserir verificação adicional para `preventAI` sem response
