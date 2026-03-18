

# Botão de Reenvio em Mensagens com Erro

## Problema
Templates enviados via WhatsApp retornam erro "Message undeliverable (131026)". Não há opção de reenviar — o atendente precisa abrir o diálogo de template novamente.

## Solução
Adicionar um botão "Reenviar" nas mensagens com `status = 'failed'`, permitindo que o atendente tente reenviar a mesma mensagem com um clique.

### 1. Atualizar `MessageBubble.tsx`
- Adicionar prop `onRetryMessage?: () => void` e `messageId?: string`
- Quando `status === 'failed'` e `onRetryMessage` existe, renderizar um botão "Reenviar" (ícone RefreshCw + texto) abaixo do indicador de status

### 2. Atualizar `MessagesWithMedia.tsx`
- Passar `onRetryMessage` callback para o `MessageBubble` quando a mensagem é `failed` e `sender_type === 'user'`
- O callback invoca a edge function `send-meta-whatsapp` com os dados originais da mensagem (extraídos do `metadata` ou `content`)
- Ao reenviar com sucesso, atualizar o status da mensagem no banco para `'sent'`

### 3. Criar hook `useRetryMessage.ts`
- Recebe `messageId`, `conversationId`
- Busca a mensagem original no banco para extrair conteúdo e metadata (template info, phone, instance_id)
- Reenvia via `send-meta-whatsapp`
- Atualiza status da mensagem de `'failed'` para `'sent'` no banco
- Invalida queries de mensagens

### 4. Atualizar `MessageStatusIndicator.tsx`
- Adicionar prop opcional `onRetry` ao componente
- No case `'failed'`, renderizar botão clicável "Reenviar" ao lado do ícone de erro

### Arquivos a alterar
- `src/components/MessageStatusIndicator.tsx` — adicionar botão retry
- `src/components/inbox/MessageBubble.tsx` — passar onRetry
- `src/components/inbox/MessagesWithMedia.tsx` — conectar retry handler
- `src/hooks/useRetryMessage.ts` — novo hook de reenvio

### Fluxo
1. Mensagem falha → aparece ícone ❌ + botão "Reenviar"
2. Atendente clica → loading spinner no botão
3. Edge function reenvia → status atualiza para "sent"
4. Se falhar de novo → volta para ❌ com novo erro

