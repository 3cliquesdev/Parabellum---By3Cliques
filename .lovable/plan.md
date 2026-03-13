

# Auditoria: UX Melhorias (Typing Indicator, Badge, Timestamps)

## Bugs Encontrados

### Bug 1 (CRÍTICO): Typing indicator nunca aparece para web_chat

No `handleSendMessage` (linha 270), o path de web_chat (linha 354-365) faz `return` na linha 365 **antes** de alcançar o código do typing indicator (linhas 371-376). Resultado: o typing indicator **nunca ativa** para conversas web_chat.

Para WhatsApp, o `setIsWaitingResponse(true)` só executa **depois** dos `await` (chamada API + save DB), ou seja, aparece com delay de 1-3s em vez de instantaneamente.

**Correção**: Mover o `setIsWaitingResponse(true)` para **antes** da lógica de envio (logo após a validação de `isInternal`), garantindo que funcione para todos os canais.

### Bug 2 (MENOR): Comentário duplicado

Linhas 158-159 têm o mesmo comentário `// ========== TYPING INDICATOR: clear when new message arrives ==========` duplicado.

**Correção**: Remover a linha duplicada.

### Bug 3 (PERFORMANCE): useRelativeTime cria 1 interval por MessageBubble

O hook `useRelativeTime` em `MessageBubble.tsx` cria um `setInterval` de 60s **por mensagem visível**. Com 50+ mensagens na tela, são 50+ intervals ativos — desperdício de recursos.

**Correção**: Mover o tick counter para o `ChatWindow` (um único interval) e passar um `tickKey` prop para os MessageBubbles para forçar recálculo. Alternativa mais simples: transformar `useRelativeTime` em uma **função pura** (sem hook) e usar um único `tickCounter` state no ChatWindow passado via prop.

### Bug 4 (EDGE CASE): Badge "Nova mensagem" pode ficar preso

O `prevMsgCount` ref é atualizado no useEffect da linha 169, mas também é lido no useEffect da linha 206-210. Como ambos dependem de `messages.length`, a ordem de execução pode causar o badge ativando incorretamente na primeira renderização.

**Correção**: Unificar a lógica — no mesmo useEffect que verifica novas mensagens (linhas 161-170), adicionar a lógica do badge.

## Plano de Correção

### Arquivo: `src/components/ChatWindow.tsx`

1. **Mover typing indicator** — colocar `setIsWaitingResponse(true)` imediatamente após o check `if (!isInternal && !isEmailMode)` na linha ~289, ANTES de qualquer `await` ou `return`
2. **Remover comentário duplicado** na linha 158
3. **Unificar useEffects** de new message detection — merge linhas 161-170 com 206-210 em um único useEffect
4. **Adicionar `tickCounter` state** com interval de 60s para timestamps relativos, passar como prop

### Arquivo: `src/components/inbox/MessageBubble.tsx`

1. **Remover hook `useRelativeTime`** — substituir por função pura `formatRelativeTime(dateStr)`
2. **Aceitar prop `_tick`** (ignorada, mas força re-render quando pai muda)

### Arquivo: `src/components/inbox/MessagesWithMedia.tsx`

1. **Passar `tickKey` prop** do ChatWindow para MessagesWithMedia → MessageBubble

### Impacto
- Typing indicator funcionará para **todos os canais** (web_chat, whatsapp, email)
- Performance: de N intervals para 1 único interval
- Zero breaking changes na API dos componentes

