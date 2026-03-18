

# Mostrar descrição do template no chat

## Problema
O template na conversa aparece truncado como "TEMPLATE com..." sem o conteúdo real. A descrição (que contém o texto do template, como "Olá, tudo bem? Sou do time comercial...") já aparece no diálogo de seleção mas não chega na bolha do chat.

## Causa
Mensagens enviadas **antes** da última atualização foram salvas como `[Template: nome]` sem o body. Além disso, o `max-w-[75%]` pode estar cortando o conteúdo.

## Solução

### 1. `MessageBubble.tsx` — Melhorar renderização de templates
- Remover truncamento no header do template (o nome "comercial" estava cortado como "com...")
- Exibir o body_text completo com espaçamento adequado
- Aumentar `min-w` para templates terem espaço suficiente

### 2. `MessageBubble.tsx` — Fallback para templates antigos
- Quando o conteúdo é `[Template: nome]` (sem body), buscar o `template_body` do metadata da mensagem (já salvo no metadata pelo edge function)
- Renderizar o body do metadata se disponível

### 3. `MessagesWithMedia.tsx` — Passar metadata para o bubble
- Garantir que o `metadata` da mensagem (que contém `template_body`) seja acessível ao MessageBubble para o fallback

### Arquivos a alterar
- `src/components/inbox/MessageBubble.tsx` — fix truncamento + fallback metadata
- `src/components/inbox/MessagesWithMedia.tsx` — passar metadata

