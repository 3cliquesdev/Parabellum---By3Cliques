
# Corrigir Botao "Reabrir Conversa" - Dois Bugs

## Diagnostico

### Bug 1: Botao errado aparece (deveria ser "Reengajar via Template")
- A conversa `41fa2aa2...` tem `channel = "whatsapp"` na tabela `conversations`
- Porem, o `inbox_view` retorna `last_channel = "web_chat"` para essa conversa
- No `Inbox.tsx` linha 165, o mapeamento usa `channel: item.last_channel` em vez do campo `channel` real
- A condicao na linha 718 (`conversation.channel === "whatsapp"`) falha porque recebe `"web_chat"`
- Resultado: mostra "Reabrir Conversa" ao inves de "Reengajar via Template"

### Bug 2: Clique no botao nao faz nada (falha silenciosa)
- A funcao `handleReopenConversation` (linhas 379-389) so trata o caso de sucesso
- Se o update falha (ex.: RLS, permissao), o erro e ignorado silenciosamente
- Nenhum toast de erro, nenhum log

## Correcoes

### Arquivo: `src/components/ChatWindow.tsx`

**1. Melhorar condicao do banner para usar tambem `whatsapp_provider`**

A condicao atual depende apenas de `conversation.channel === "whatsapp"`. Adicionar fallback para detectar WhatsApp via `whatsapp_provider` ou presenca de `whatsapp_meta_instance_id`:

```
// De:
conversation.channel === "whatsapp" && (conversation.whatsapp_instance_id || conversation.whatsapp_meta_instance_id)

// Para:
(conversation.channel === "whatsapp" || conversation.whatsapp_provider || conversation.whatsapp_meta_instance_id || conversation.whatsapp_instance_id)
```

Isso garante que mesmo se `channel` vier mapeado errado do inbox_view, a presenca de qualquer campo WhatsApp aciona o botao correto.

**2. Adicionar tratamento de erro no `handleReopenConversation`**

```typescript
const handleReopenConversation = async () => {
  if (!conversation) return;
  const { error } = await supabase
    .from("conversations")
    .update({ status: "open", closed_at: null })
    .eq("id", conversation.id);
  if (error) {
    console.error('[ChatWindow] Erro ao reabrir conversa:', error);
    toast({
      title: "Erro ao reabrir conversa",
      description: error.message,
      variant: "destructive",
    });
    return;
  }
  queryClient.invalidateQueries({ queryKey: ["conversations"] });
  toast({ title: "Conversa reaberta" });
};
```

### Arquivo: `src/pages/Inbox.tsx` (correcao na raiz)

**3. Corrigir mapeamento de `channel` no `inboxItemToConversation`**

Linha 165: trocar `last_channel` pelo campo correto. A `inbox_view` tambem tem o campo `channel` original? Se nao, usar `whatsapp_provider` como indicador.

Verificar se `inbox_view` expoe o campo `channel` real da conversa. Se nao, adicionar fallback:

```typescript
// Logica: se tem whatsapp_provider, o canal real e whatsapp
channel: item.channel || (item.whatsapp_provider ? 'whatsapp' : item.last_channel),
```

## Zero regressao

- Apenas muda condicao de exibicao do botao e adiciona tratamento de erro
- ReengageTemplateDialog continua igual
- SuperComposer, Kill Switch, CSAT guard: sem impacto
- A correcao do mapeamento de channel beneficia qualquer outro lugar que dependa desse campo
