
# Botao Fixo "Reengajar / Reabrir" para Conversas Encerradas

## O que muda

Quando a conversa esta encerrada, um **banner fixo** aparece acima do composer (na parte inferior do chat, sempre visivel), com o botao de acao adequado. O usuario nao precisa rolar ate o topo para encontrar o botao.

## Arquivo impactado

`src/components/ChatWindow.tsx`

## Mudancas tecnicas

### 1. Adicionar banner fixo acima do composer quando `conversation.status === "closed"`

Na area do footer (entre o CopilotSuggestionCard e o SuperComposer/TakeControl), inserir um banner fixo:

```text
+----------------------------------------------+
|  Esta conversa foi encerrada                  |
|  [Reengajar via Template]  (WhatsApp)         |
+----------------------------------------------+
|  Conversa encerrada  (composer desabilitado)  |
+----------------------------------------------+
```

### 2. Logica do banner

- Se `conversation.status === "closed"`:
  - Mostrar banner com fundo `bg-amber-50 dark:bg-amber-950/30` e borda superior
  - Se canal WhatsApp com instancia configurada: botao **"Reengajar via Template"** (abre `ReengageTemplateDialog`)
  - Se canal nao-WhatsApp (webchat, etc.): botao **"Reabrir Conversa"** que faz update direto do status para `open`

### 3. Manter banner do topo (linhas 654-670)

O banner informativo no topo das mensagens ("Esta conversa foi encerrada") permanece como indicador visual, mas **sem o botao** (evitar duplicacao). Apenas texto informativo.

### 4. Posicao no layout

Inserir o novo banner fixo logo antes do bloco `canShowTakeControl` (linha 710), dentro de uma condicional `conversation.status === "closed"`:

```typescript
{conversation.status === "closed" && (
  <div className="flex-none p-3 border-t border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
    <div className="max-w-3xl mx-auto flex items-center justify-center gap-3">
      <span className="text-sm text-amber-700 dark:text-amber-400 font-medium">
        Esta conversa foi encerrada
      </span>
      {conversation.channel === "whatsapp" && (conversation.whatsapp_instance_id || conversation.whatsapp_meta_instance_id) ? (
        <Button size="sm" onClick={() => setReengageDialogOpen(true)} className="bg-primary hover:bg-primary/90">
          <Send className="h-3.5 w-3.5 mr-1" />
          Reengajar via Template
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={handleReopenConversation}>
          Reabrir Conversa
        </Button>
      )}
    </div>
  </div>
)}
```

### 5. Funcao `handleReopenConversation` (para canais nao-WhatsApp)

```typescript
const handleReopenConversation = async () => {
  const { error } = await supabase
    .from("conversations")
    .update({ status: "open", closed_at: null })
    .eq("id", conversation.id);
  if (!error) {
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    toast({ title: "Conversa reaberta" });
  }
};
```

### 6. Remover botao duplicado do banner do topo (linha 659-669)

Remover apenas o `Button` de dentro do banner no topo das mensagens, mantendo o texto "Esta conversa foi encerrada".

## Zero regressao

- `ReengageTemplateDialog` continua igual, so muda quem o abre
- SuperComposer continua desabilitado para conversas fechadas
- Kill Switch, Shadow Mode, CSAT guard: sem impacto
- Timeline e sidebar sem alteracao
