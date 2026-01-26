

## Plano: Correção do Bug de Handoff que Não Transfere

### Diagnóstico

Analisei detalhadamente o fluxo de handoff e identifiquei a causa raiz do problema relatado: **"bot avisa mas não transfere"**.

#### Evidências Encontradas

1. **No banco de dados** - Conversa `71d2d010-bbdb-45f5-b518-9859fb9652e5`:
   - Última mensagem: "vou te conectar com um de nossos especialistas"
   - ai_mode: `autopilot` (deveria ser `waiting_human`)
   - assigned_to: `null` (deveria ter um agente)

2. **Nos logs do route-conversation**:
   - 11:25:34: "Processing conversation: 71d2d010..."
   - 11:25:35: "ai_mode: waiting_human → waiting_human"
   - 11:25:35: "Assigning to: Camila de Farias"
   - **Atribuição foi feita com sucesso!**

3. **Problema**: O estado foi REVERTIDO após a atribuição bem-sucedida

### Causa Raiz

Existe uma **condição de corrida (race condition)** entre dois fluxos de handoff no `ai-autopilot-chat`:

```text
FLUXO 1: LOW CONFIDENCE HANDOFF (Linha ~2089)
+------------------------------------------+
| 1. Atualiza ai_mode → waiting_human      |
| 2. Chama route-conversation              |
| 3. Salva mensagem de handoff             |
| 4. RETORNA                               |
+------------------------------------------+

FLUXO 2: FALLBACK DETECTOR (Linha ~4391)
+------------------------------------------+
| 1. Detecta frase de handoff na mensagem  |
| 2. Atualiza ai_mode → copilot            |
| 3. Chama route-conversation NOVAMENTE    |
| 4. Se no_agents_available:               |
|    - REVERTE ai_mode → autopilot         |
|    - assigned_to → NULL                  |
+------------------------------------------+
```

**O Bug Específico:**
- O Fluxo 1 (Low Confidence) retorna com sucesso após handoff
- MAS outra instância/chamada do ai-autopilot-chat pode ser disparada
- O Fluxo 2 (Fallback Detector) detecta a mensagem de handoff salva
- Se nesse momento os agentes ficaram offline (ou há timing issue), reverte tudo

### Solução Proposta

#### 1. Adicionar Flag de Handoff Executado

Marcar na conversa que um handoff já foi executado para evitar processamento duplicado:

```sql
-- Adicionar coluna se não existir
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS 
  handoff_executed_at TIMESTAMP WITH TIME ZONE;
```

#### 2. Modificar ai-autopilot-chat

**Verificação Anti-Duplicata no Início:**
```typescript
// NO INÍCIO DA FUNÇÃO - Antes de qualquer processamento
const { data: convCheck } = await supabaseClient
  .from('conversations')
  .select('ai_mode, handoff_executed_at')
  .eq('id', conversationId)
  .single();

// Se handoff foi executado nos últimos 30 segundos, ignorar
const handoffAge = convCheck?.handoff_executed_at 
  ? Date.now() - new Date(convCheck.handoff_executed_at).getTime()
  : Infinity;

if (convCheck?.ai_mode !== 'autopilot' && handoffAge < 30000) {
  console.log('[ai-autopilot-chat] ⏸️ Handoff recente detectado - ignorando');
  return new Response(JSON.stringify({
    status: 'skipped',
    reason: 'recent_handoff'
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
```

**Marcar Timestamp no Handoff:**
```typescript
// QUANDO HANDOFF É EXECUTADO (em ambos os fluxos)
await supabaseClient
  .from('conversations')
  .update({ 
    ai_mode: 'waiting_human',
    handoff_executed_at: new Date().toISOString() // NOVO
  })
  .eq('id', conversationId);
```

#### 3. Remover Reversão Automática para Autopilot

A lógica que reverte para `autopilot` quando não há agentes (linhas 4412-4423) é problemática. Em vez de reverter, deve:

```typescript
// ANTES (problemático):
if (routeResult?.no_agents_available) {
  await supabaseClient.from('conversations').update({ 
    ai_mode: 'autopilot',  // ❌ REVERTE!
    needs_human_review: true
  }).eq('id', conversationId);
}

// DEPOIS (correto):
if (routeResult?.no_agents_available) {
  // Manter waiting_human - cliente aguarda na fila
  await supabaseClient.from('conversations').update({ 
    ai_mode: 'waiting_human',  // ✅ MANTÉM
    needs_human_review: true,
    queue_priority: 1  // Alta prioridade na fila
  }).eq('id', conversationId);
  
  // Mensagem diferente para o cliente
  assistantMessage = 'Vou te conectar com um especialista! ' +
    'Nossa equipe está ocupada no momento, mas você está na fila ' +
    'e será atendido em breve.';
}
```

### Implementação

#### Arquivos a Modificar

1. **supabase/functions/ai-autopilot-chat/index.ts**
   - Adicionar verificação anti-duplicata no início
   - Remover reversão para autopilot quando sem agentes
   - Marcar timestamp de handoff

2. **Migration SQL**
   - Adicionar coluna `handoff_executed_at` em `conversations`

### Resultado Esperado

- Handoffs serão persistentes e não serão revertidos
- Conversas aguardarão na fila `waiting_human` até um agente responder
- Mensagem de "vou te conectar" será cumprida de fato
- Flag `needs_human_review` garante prioridade quando agentes ficarem online

### Testes Recomendados

1. Enviar mensagem que dispare handoff por baixa confiança
2. Verificar que `ai_mode` permanece `waiting_human`
3. Verificar que `assigned_to` está preenchido (ou conversa está na fila)
4. Enviar nova mensagem do cliente - deve ser ignorada pela IA
5. Agente responder - `ai_mode` muda para `copilot`

