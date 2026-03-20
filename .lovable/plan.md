

# Fix: Tag de Saque Não Aplicada na Conversa (Path Determinístico)

## Diagnóstico

A conversa #4C64C0A0 seguiu o **path determinístico** de saque (linha 6348 do `ai-autopilot-chat`), que detecta dados PIX na mensagem e cria o ticket diretamente sem passar pela tool call `create_ticket`. O ticket foi criado com sucesso (log confirma `saque_ticket_created salvo (path determinística)`), mas a **tag "6.05 Saque do saldo"** nunca foi adicionada à conversa.

**Por quê?** A lógica de adicionar a tag à `conversation_tags` só existe no **path da tool call** (linha 9219), não no path determinístico (linha 6348-6386). São dois caminhos distintos para criar tickets de saque, mas só um aplica a tag.

**Evidência:** Query direta confirma `conversation_tags` vazio para esta conversa.

## Correção

### `supabase/functions/ai-autopilot-chat/index.ts` — Path determinístico (~linha 6386)

Após persistir a flag `saque_ticket_created`, adicionar a mesma lógica de tag que já existe no path da tool call (linhas 9220-9241):

```typescript
// Após saque_ticket_created salvo (linha 6386):

// 🏷️ Adicionar tag "Saque do saldo" à conversa (para auto-close usar tag correta)
try {
  const { data: saqueTag } = await supabaseClient
    .from('tags')
    .select('id')
    .or('name.ilike.%saque%saldo%,name.ilike.%6.05%')
    .maybeSingle();

  if (saqueTag?.id) {
    await supabaseClient
      .from('conversation_tags')
      .upsert(
        { conversation_id: conversationId, tag_id: saqueTag.id },
        { onConflict: 'conversation_id,tag_id' }
      );
    console.log('[ai-autopilot-chat] 🏷️ Tag saque adicionada à conversa (path determinística)');
  }
} catch (tagErr) {
  console.warn('[ai-autopilot-chat] ⚠️ Erro ao adicionar tag saque à conversa:', tagErr);
}
```

Também adicionar a tag à `protected_conversation_tags` para que não seja removida acidentalmente antes do auto-close.

### Deploy

Redeployar `ai-autopilot-chat` com version bump para `BUILD-V5 2026-03-20`.

### Resultado

Quando o ticket de saque é criado pela path determinística, a conversa recebe automaticamente a tag "6.05 Saque do saldo". Se for fechada por inatividade, o auto-close usará essa tag (prioridade 1: `close_tag_id` do nó → ou a tag da conversa) em vez do fallback "Falta de Interação".

