
# Plano: Corrigir Transferências Não Executadas pelo Fluxo

## Diagnóstico Completo

Após investigação profunda, identifiquei o **bug raiz** que faz com que conversas transferidas para o departamento Comercial continuem sendo respondidas pela IA.

### Evidências Encontradas

| Conversa | Departamento | ai_mode | handoff_executed_at | Problema |
|----------|--------------|---------|---------------------|----------|
| 2c34993d... | Comercial | **autopilot** | NULL | ❌ Transferência não executou |
| 87415fb1... | Comercial | **autopilot** | 2026-01-29 14:50:18 | ❌ ai_mode não mudou |
| 0f668c7d... | Comercial | **autopilot** | NULL | ❌ Transferência não executou |
| + 7 outras | Comercial | **autopilot** | misto | ❌ Mesmo problema |

### Estado dos Agentes do Comercial

Todos os 30+ agentes do departamento Comercial estão **offline**. Isso explica por que o dispatcher não consegue atribuir, mas não explica por que o `ai_mode` não muda para `waiting_human`.

### Bug Identificado

O problema está no **meta-whatsapp-webhook** nas linhas 621-674:

```typescript
// CASO 2: Fluxo retornou resposta estática (Message/AskOptions/etc)
if (!flowData.useAI && flowData.response) {  // ❌ BUG: Requer response
  // ... envia mensagem ...
  
  // 🆕 EXECUTAR TRANSFERÊNCIA SE NECESSÁRIO
  if (flowData.transfer) {  // ❌ NUNCA EXECUTA SE response é vazio/undefined
    // atualiza ai_mode = 'waiting_human'
  }
}
```

A condição `flowData.response` é **obrigatória** para entrar no CASO 2. Se o nó de transferência não tem mensagem configurada (ou foi apagada), a transferência **nunca é executada**.

### Fluxo do Bug

```text
Cliente responde "1" (Drop Nacional)
        ↓
process-chat-flow retorna:
  { transfer: true, departmentId: "Comercial", response: "" }
        ↓
meta-whatsapp-webhook verifica CASO 2:
  !flowData.useAI (✅ true) && flowData.response (❌ "" = falsy)
        ↓
CASO 2 NÃO ENTRA → Pula para CASO 3
        ↓
CASO 3: flowData.useAI (❌ false) → Não entra
        ↓
CASO 4 (fallback): ai_mode = 'waiting_human'
        ↓
❌ MAS: department não foi atualizado!
❌ E: handoff_executed_at não foi setado!
```

**Resultado**: A conversa fica em `waiting_human` MAS sem departamento correto, ou fica em `autopilot` se alguma outra lógica interferir.

## Solução

Separar a **verificação de transferência** da verificação de resposta, garantindo que transferências sejam executadas **independentemente** de haver mensagem.

### Mudanças Necessárias

**Arquivo:** `supabase/functions/meta-whatsapp-webhook/index.ts`

1. **Mover a execução de transferência para ANTES do continue** (ou para um bloco separado)
2. **Verificar `flowData.transfer` de forma independente** de `flowData.response`
3. **Garantir que `ai_mode = 'waiting_human'` seja setado** mesmo se não há mensagem

### Código Corrigido

```typescript
// CASO 2: Fluxo retornou resposta estática (Message/AskOptions/etc)
if (!flowData.useAI && flowData.response) {
  // ... envia mensagem normalmente ...
}

// 🆕 EXECUTAR TRANSFERÊNCIA INDEPENDENTEMENTE DE HAVER RESPOSTA
if (flowData.transfer) {
  console.log("[meta-whatsapp-webhook] 🔄 Executing transfer to department:", flowData.departmentId);
  
  const updateData: Record<string, unknown> = {
    ai_mode: 'waiting_human',
    handoff_executed_at: new Date().toISOString(),
  };
  
  if (flowData.departmentId) {
    updateData.department = flowData.departmentId;
  }
  
  const { error: updateError } = await supabase
    .from("conversations")
    .update(updateData)
    .eq("id", conversation.id);
  
  if (updateError) {
    console.error("[meta-whatsapp-webhook] ❌ Error executing transfer:", updateError);
  } else {
    console.log("[meta-whatsapp-webhook] ✅ Transfer executed → department:", flowData.departmentId, "ai_mode: waiting_human");
  }
  
  continue; // Pular para próxima mensagem após transferência
}
```

## Impacto Esperado

### Antes (Bug)

| Cenário | Resultado |
|---------|-----------|
| Transferência com mensagem | ✅ Funciona |
| Transferência sem mensagem | ❌ IA continua respondendo |
| Transferência com response vazio | ❌ IA continua respondendo |

### Depois (Corrigido)

| Cenário | Resultado |
|---------|-----------|
| Transferência com mensagem | ✅ Funciona |
| Transferência sem mensagem | ✅ ai_mode = waiting_human |
| Transferência com response vazio | ✅ ai_mode = waiting_human |

## Correção Adicional: Conversas Órfãs

Além da correção do código, precisamos corrigir as **10 conversas** que já estão em autopilot mas deveriam estar em waiting_human:

```sql
UPDATE conversations
SET ai_mode = 'waiting_human'
WHERE department = 'f446e202-bdc3-4bb3-aeda-8c0aa04ee53c'  -- Comercial
  AND ai_mode = 'autopilot'
  AND status = 'open'
  AND assigned_to IS NULL;
```

## Arquivos a Modificar

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| `supabase/functions/meta-whatsapp-webhook/index.ts` | Edge Function | Separar lógica de transferência |
| Migration SQL | Banco de Dados | Corrigir conversas órfãs |

## Compatibilidade

- Não afeta transferências que já funcionam (com resposta)
- Corrige edge case de transferências sem mensagem
- Mantém toda lógica existente de fluxo/IA

---

## Seção Técnica

### Estrutura Final do Webhook (Pseudocódigo)

```text
// CASO 1: skipAutoResponse (cliente na fila)
if (flowData.skipAutoResponse) → continue

// CASO 2: Resposta estática (envia mensagem)
if (!flowData.useAI && flowData.response) {
  → enviar mensagem
}

// CASO 2.5: 🆕 TRANSFERÊNCIA (independente de response)
if (flowData.transfer) {
  → atualizar ai_mode = 'waiting_human'
  → atualizar department = flowData.departmentId
  → continue
}

// CASO 3: AIResponseNode
if (flowData.useAI && flowData.aiNodeActive) {
  → chamar ai-autopilot-chat
  → continue
}

// CASO 4: Fallback
→ ai_mode = 'waiting_human'
```

### Verificação Pós-Deploy

1. Enviar mensagem de teste que dispare transferência
2. Verificar logs: deve aparecer "🔄 Executing transfer"
3. Verificar banco: `ai_mode = 'waiting_human'` e `department` correto
4. Cliente não deve receber mais respostas da IA
