

# Upgrade Visual Enterprise — WhatsApp Web + CRM (CORRIGIDO)

## Ajustes Aplicados Nesta Versão

| # | Ajuste Solicitado | Status |
|---|-------------------|--------|
| 1 | Wrapper enterprise completo no SuperComposer | ✅ Incluído com snippet exato |
| 2 | Remover `scrollIntoView` antigo do ChatWindow | ✅ Explícito na Fase 4 |
| 3 | Padding via `getComputedStyle` no hook | ✅ Já estava |

---

## Fase 1: Tokens Visuais (src/index.css)

Adicionar variáveis CSS dedicadas para área de chat:

```css
:root {
  /* === CHAT TOKENS (Enterprise) === */
  --chat-bg: 210 20% 98%;
  --chat-surface: 0 0% 100%;
  --chat-border: 215 16% 88%;
}

.dark {
  /* === CHAT TOKENS (Enterprise) === */
  --chat-bg: 222 18% 12%;
  --chat-surface: 222 18% 14%;
  --chat-border: 215 10% 28%;
}
```

**Impacto:** Zero — apenas cria tokens para uso posterior.

---

## Fase 2: Hook Auto-Resize (NOVO ARQUIVO)

**Criar:** `src/hooks/useAutoResizeTextarea.ts`

```typescript
import { useLayoutEffect } from "react";

export function useAutoResizeTextarea(
  ref: React.RefObject<HTMLTextAreaElement>,
  value: string,
  maxRows = 6,
  lineHeightPx = 22
) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Medir padding real via getComputedStyle (AJUSTE #1)
    const computed = window.getComputedStyle(el);
    const padTop = parseFloat(computed.paddingTop || "0");
    const padBottom = parseFloat(computed.paddingBottom || "0");
    const verticalPadding = padTop + padBottom;

    el.style.height = "0px";

    const maxHeight = maxRows * lineHeightPx + verticalPadding;
    const next = Math.min(el.scrollHeight, maxHeight);
    
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [ref, value, maxRows, lineHeightPx]);
}
```

---

## Fase 3: Composer WhatsApp Web (SuperComposer.tsx)

**Arquivo:** `src/components/inbox/SuperComposer.tsx`

### Mudanças:

1. **Importar hook** no topo
2. **Aplicar hook** após declaração do `textareaRef`
3. **Substituir o JSX do return** pelo wrapper enterprise

### 3.1 Adicionar import (linha ~1):

```typescript
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";
```

### 3.2 Aplicar hook (após linha 76):

```typescript
const textareaRef = useRef<HTMLTextAreaElement>(null);

// NOVO: Auto-resize até 6 linhas
useAutoResizeTextarea(textareaRef, message, 6, 22);
```

### 3.3 Substituir return (linhas 534-737)

**ANTES (estrutura atual):**
```tsx
<div className="flex-none bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-t border-slate-200 dark:border-zinc-800">
  {/* Tabs */}
  <div className="px-4 pt-3 ...">
    ...
  </div>
  {/* Input Area */}
  <div className="p-4 pt-3">
    <div className="max-w-3xl mx-auto flex gap-2 items-end">
      ...
      <Textarea rows={2} className="... min-h-[60px] max-h-40 ..." />
      ...
    </div>
  </div>
</div>
```

**DEPOIS (wrapper enterprise):**

```tsx
<div className="border-t border-[hsl(var(--chat-border))] bg-[hsl(var(--chat-surface))]">
  {/* Tabs - mantém igual */}
  <div className="px-4 pt-3 flex items-center justify-between gap-3">
    <Tabs value={messageMode} onValueChange={(v) => setMessageMode(v as MessageMode)}>
      {/* ... conteúdo existente das tabs ... */}
    </Tabs>
  </div>

  {/* Internal Note Warning - mantém igual */}
  {isInternal && (
    <div className="mx-4 mt-2 flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/30 px-3 py-1.5 rounded-md">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>Esta mensagem é visível apenas para a equipe interna</span>
    </div>
  )}

  {/* Pending Attachments Preview - mantém igual */}
  {hasAttachments && (
    <div className="px-4 pt-3">
      {/* ... conteúdo existente ... */}
    </div>
  )}

  {/* ========== WRAPPER ENTERPRISE (NOVO) ========== */}
  <div className="max-w-[1180px] mx-auto px-4 py-3">
    <div className="flex items-end gap-2 rounded-2xl border border-[hsl(var(--chat-border))] bg-background p-2">
      
      {isRecordingAudio ? (
        <AudioRecorder
          onRecordingComplete={handleAudioComplete}
          onCancel={() => setIsRecordingAudio(false)}
          disabled={isDisabled}
        />
      ) : (
        <>
          {/* Botões esquerda - mantém igual */}
          <FlowPickerButton conversationId={conversationId} disabled={isDisabled || isSending} />
          <MacrosPopover onSelectMacro={handleMacroSelect} disabled={isDisabled || isSending} />
          <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={handleStartAudioRecording} disabled={isDisabled || isSending}>
            <Mic className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Popover open={showAttachmentPicker} onOpenChange={setShowAttachmentPicker}>
            {/* ... popover existente ... */}
          </Popover>

          {/* TEXTAREA ATUALIZADO */}
          <SlashCommandMenu value={message} onChange={setMessage}>
            <Textarea
              ref={textareaRef}
              placeholder={isDisabled ? "Conversa encerrada" : "Digite sua mensagem ou / para macros..."}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              disabled={isSending || isDisabled}
              rows={1}
              className={cn(
                "w-full resize-none bg-transparent border-0",
                "text-[15px] leading-[22px]",
                "px-3 py-2",
                "min-h-[44px] max-h-[160px]",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
                "placeholder:text-muted-foreground",
                isInternal && "bg-yellow-50/50 dark:bg-yellow-900/20"
              )}
            />
          </SlashCommandMenu>

          {/* Send Button - mantém igual */}
          <Button onClick={handleSend} disabled={!canSend || isSending || isDisabled} size="icon"
            className={cn("rounded-full h-11 w-11 shrink-0 shadow-md transition-colors", isInternal && "bg-yellow-500 hover:bg-yellow-600")}>
            {isInternal ? <StickyNote className="h-5 w-5" /> : <Send className="h-5 w-5" />}
          </Button>
        </>
      )}
    </div>

    {/* HINT ENTERPRISE (NOVO) */}
    <div className="mt-1 flex justify-end text-[11px] text-muted-foreground">
      Enter envia • Shift+Enter quebra linha
    </div>
  </div>
</div>
```

---

## Fase 4: Smart Scroll (ChatWindow.tsx) — COM REMOÇÃO EXPLÍCITA

**Arquivo:** `src/components/ChatWindow.tsx`

### 4.1 REMOVER o useEffect antigo (linhas 144-146):

```typescript
// ❌ REMOVER COMPLETAMENTE ESTE BLOCO:
useEffect(() => {
  messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages]);
```

### 4.2 Adicionar novos estados/refs (após linha 86):

```typescript
const messagesEndRef = useRef<HTMLDivElement>(null);  // já existe

// NOVO: Smart scroll refs
const scrollRef = useRef<HTMLDivElement>(null);
const [shouldStickToBottom, setShouldStickToBottom] = useState(true);
```

### 4.3 Adicionar novo useEffect para detectar scroll (onde estava o antigo):

```typescript
// Detectar se usuário scrollou para cima
useEffect(() => {
  const el = scrollRef.current;
  if (!el) return;

  const onScroll = () => {
    const distance = el.scrollHeight - (el.scrollTop + el.clientHeight);
    setShouldStickToBottom(distance < 140);
  };

  el.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  return () => el.removeEventListener("scroll", onScroll);
}, []);

// Scroll apenas se estiver "grudado" no final
// AJUSTE #2: Usar messages?.length (não array inteiro)
useEffect(() => {
  const el = scrollRef.current;
  if (!el || !shouldStickToBottom) return;
  el.scrollTop = el.scrollHeight; // instant (WhatsApp-like)
}, [messages?.length, shouldStickToBottom]);
```

### 4.4 Aplicar ref no container de mensagens (linha ~550):

Localizar o `<div>` que contém `<MessagesWithMedia>` e adicionar `ref={scrollRef}`:

```tsx
<div
  ref={scrollRef}
  className="flex-1 min-h-0 overflow-y-auto bg-[hsl(var(--chat-bg))]"
>
  <MessagesWithMedia ... />
</div>
```

---

## Fase 5: Espaçamento Enterprise (MessagesWithMedia.tsx)

**Arquivo:** `src/components/inbox/MessagesWithMedia.tsx`

Localizar o container principal das mensagens e ajustar:

```tsx
// Antes:
<div className="space-y-4">

// Depois:
<div className="space-y-3 py-4">
```

---

## Fase 6: Bolhas CRM Sério (MessageBubble.tsx)

**Arquivo:** `src/components/inbox/MessageBubble.tsx`

### 6.1 Ajustar classes da bolha principal:

```tsx
// Antes:
<div className={cn(
  "max-w-[85%] min-w-[120px] px-4 py-3 shadow-sm",
  ...
)}>

// Depois:
<div className={cn(
  "max-w-[78%] min-w-[120px] px-4 py-3",
  "text-[14px] leading-5 shadow-sm",
  isCustomer
    ? "bg-slate-900 text-white rounded-2xl rounded-tl-none"
    : isAI
    ? "bg-[hsl(var(--chat-surface))] border border-[hsl(var(--chat-border))] text-foreground rounded-2xl rounded-tr-none"
    : "bg-primary text-primary-foreground rounded-2xl rounded-tr-none"
)}>
```

### 6.2 Ajustar timestamp:

```tsx
// Antes:
"text-[10px] mt-1..."

// Depois:
"text-[11px] mt-1..."
```

---

## Fase 7: Header Sem Emojis (ChatWindow.tsx)

**Arquivo:** `src/components/ChatWindow.tsx` (linhas 397-403)

```tsx
// Antes:
{isAutopilot && "🤖 Autopilot"}
{isCopilot && "🧠 Copilot"}
{isDisabled && "👤 Manual"}

// Depois:
{isAutopilot && "Autopilot"}
{isCopilot && "Copilot"}
{isDisabled && "Manual"}
```

---

## Resumo de Arquivos Modificados

| Arquivo | Operação | Risco |
|---------|----------|-------|
| `src/index.css` | Adicionar tokens | Zero |
| `src/hooks/useAutoResizeTextarea.ts` | Criar novo | Zero |
| `src/components/inbox/SuperComposer.tsx` | Refatorar JSX + hook | Baixo |
| `src/components/ChatWindow.tsx` | Remover scrollIntoView + smart scroll | Baixo |
| `src/components/inbox/MessagesWithMedia.tsx` | Ajustar classes | Zero |
| `src/components/inbox/MessageBubble.tsx` | Ajustar classes | Baixo |

---

## Garantias de Não-Regressão

- **Kill Switch**: Não alterado
- **Shadow Mode**: Não alterado  
- **Fluxos de chat**: Não alterado
- **CSAT Guard**: Não alterado
- **Distribuição automática**: Não alterado
- **Upload de mídia**: Lógica preservada integralmente
- **Áudio/Transcoding**: Lógica preservada integralmente
- **Realtime**: Não afetado
- **RLS/Permissões**: Não afetado
- **Funções de envio (handleSend, sendInstant)**: Não alteradas

---

## Checklist QA Pós-Implementação

| Item | Validação |
|------|-----------|
| Composer expande até 6 linhas | Digitar texto longo |
| Scroll interno após 6 linhas | Verificar overflow |
| Enter envia, Shift+Enter quebra | Preservado |
| Scroll não puxa ao ler histórico | Rolar para cima e receber msg |
| Wrapper rounded-2xl visível | Visual |
| Bolhas com max-w 78% | Visual |
| Timestamps 11px | Visual |
| Badges sem emoji | Visual |
| Upload de mídia funciona | Testar anexo |
| Gravação de áudio funciona | Testar gravação |
| WhatsApp Meta envia | Testar envio |
| Console sem erros | F12 DevTools |

