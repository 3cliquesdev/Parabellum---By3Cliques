

# Fix: Auto-close ignorando mensagens automáticas de bot

## Problema

O auto-close verifica se a última mensagem é `sender_type: contact` para decidir se pula o fechamento. Mas mensagens automáticas do bot (como "Sua conversa já está na fila") têm `sender_type: user`, mascarando a mensagem real do cliente enviada segundos antes.

Resultado: conversa fechada por "inatividade" 8 minutos depois do cliente enviar uma mensagem real.

## Solução

Em todas as 4 etapas do auto-close que verificam `lastMsg.sender_type`, mudar a query para ignorar mensagens automáticas de bot (mensagens com metadata de fluxo ou mensagens de fila). A abordagem mais robusta é verificar as **últimas 2-3 mensagens** em vez de apenas a última, e considerar a conversa ativa se QUALQUER uma delas for do contato dentro da janela de inatividade.

### Abordagem escolhida

Em vez de checar apenas a última mensagem, buscar as **últimas 3 mensagens** e considerar como "contato ativo" se alguma delas for `sender_type: contact` e foi enviada dentro do threshold de inatividade. Isso protege contra mensagens automáticas de bot que "cobrem" a mensagem real do cliente.

### Arquivo

`supabase/functions/auto-close-conversations/index.ts`

### Mudanças

1. Criar uma função helper `isContactActive()` que:
   - Busca as últimas 3 mensagens da conversa
   - Retorna `true` se alguma mensagem do contato foi enviada **depois** do threshold de inatividade (ou seja, o contato falou recentemente)
   
2. Substituir as 4 verificações de `lastMsg.sender_type === 'contact'` (Etapas 2, 3, 3b e 4) pela chamada à função helper

### Lógica do helper

```text
function isContactActive(messages[], threshold):
  for each msg in last 3 messages:
    if msg.sender_type === 'contact' AND msg.created_at > threshold:
      return true  // contato mandou mensagem recente
  return false
```

Isso resolve o cenário onde:
- Cliente manda mensagem às 13:31:54
- Bot responde automaticamente às 13:31:56
- Auto-close roda às 13:40 → vê que a mensagem do CONTATO (13:31:54) está dentro da janela → **não fecha**

### Estimativa

4 substituições no mesmo arquivo, 1 função helper nova. Zero mudanças em outros arquivos.

