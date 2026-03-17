

# Fix: Textos Estranhos (Encoding UTF-8) + Loop de Quota Error

## Diagnóstico

Dois problemas identificados na conversa `13F64C4B`:

### 1. Emoji corrompido (`ðŸ™` em vez de `🙏`)
O arquivo `ai-autopilot-chat/index.ts` tem encoding corrompido em várias strings. A mensagem de quota salva no banco contém `ðŸ™` (bytes UTF-8 interpretados como Latin-1) em vez do emoji correto. Isso polui o histórico e confunde a IA quando comprime/lê o contexto.

### 2. Loop infinito de "alta demanda"
A cada ~1 minuto, o `process-buffered-messages` re-processa a conversa, chama `ai-autopilot-chat`, que falha com `QUOTA_ERROR` (HTTP 429 na OpenAI), salva outra mensagem "alta demanda" no banco, e repete. São **8+ mensagens idênticas** acumuladas no histórico, poluindo o contexto da IA.

## Solução

### Alteração 1 — Corrigir encoding da mensagem de quota
No `ai-autopilot-chat/index.ts`, trocar a string corrompida:
```
// DE:
"Estou com alta demanda no momento. Por favor, tente novamente em alguns instantes. ðŸ™"
// PARA:  
"Estou com alta demanda no momento. Por favor, tente novamente em alguns instantes."
```
Remover o emoji problemático para evitar encoding issues. Aplicar a mesma correção em todas as ocorrências.

### Alteração 2 — Anti-loop: não repetir mensagem de quota
Antes de salvar a mensagem de "alta demanda", verificar se a última mensagem da conversa já é essa mesma mensagem. Se for, pular o insert — evita o loop de mensagens repetidas.

Lógica:
```typescript
// Antes de inserir mensagem de quota:
const { data: lastMsg } = await supabaseClient
  .from('messages')
  .select('content')
  .eq('conversation_id', conversationId)
  .eq('is_ai_generated', true)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

if (lastMsg?.content?.includes('alta demanda')) {
  // Já avisou — não repetir
  return response com status quota_error sem re-enviar;
}
```

### Resumo
- **1 arquivo editado**: `supabase/functions/ai-autopilot-chat/index.ts`
- Corrige encoding da mensagem de fallback
- Adiciona guard anti-loop para não repetir mensagem de quota
- Zero alterações no frontend ou banco

