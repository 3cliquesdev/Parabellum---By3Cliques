

# Ajustes Visuais Finos — Composer, Bolhas e Tipografia

## Escopo
Apenas mudanças em `className` / tokens Tailwind. Zero alteração em hooks, lógica, handlers ou backend.

---

## 1. Composer — Espaçamentos

**Arquivo:** `src/components/inbox/SuperComposer.tsx`

| Local | Atual | Proposta | Razão |
|-------|-------|----------|-------|
| Wrapper externo (L648) | `px-4 py-3` | `px-4 py-2` | Menos "pesado" |
| Container rounded (L649) | `gap-2 p-2` | `gap-3 p-2.5` | Respiro entre botões |
| Textarea (L702-710) | `px-3 py-2` | `px-4 py-2.5` | Mais confortável |
| Hint (L734) | `mt-1` | `mt-1.5` | Separação sutil |

---

## 2. Bolhas — Largura e Padding

**Arquivo:** `src/components/inbox/MessageBubble.tsx`

| Local | Atual | Proposta | Razão |
|-------|-------|----------|-------|
| Bolha principal (L141) | `max-w-[78%]` | `max-w-[75%]` | Mais "WhatsApp" |
| Bolha principal | `px-4 py-3` | `px-4 py-2.5` | Mais compacto |
| Timestamp (L235) | `mt-1` | `mt-1.5` | Respiro visual |

---

## 3. Tipografia do Chat

**Arquivo:** `src/components/inbox/MessageBubble.tsx`

| Local | Atual | Proposta | Razão |
|-------|-------|----------|-------|
| Bolha (L142) | `text-[14px] leading-5` | `text-[15px] leading-relaxed` | Leitura mais confortável |
| SafeHTML (L228-229) | `text-sm` | — (herda da bolha) | Já herda |
| Timestamp (L235) | `text-[11px]` | `text-[11px]` | OK |

---

## 4. Container de Mensagens

**Arquivo:** `src/components/ChatWindow.tsx` (L603-604)

| Local | Atual | Proposta | Razão |
|-------|-------|----------|-------|
| Container interno | `p-4 md:p-6` | `px-4 py-6 md:px-6` | Respiro vertical |
| Max-width wrapper (L604) | `max-w-3xl` | `max-w-4xl` | Mais espaço para bolhas |

---

## 5. MessagesWithMedia — Spacing

**Arquivo:** `src/components/inbox/MessagesWithMedia.tsx`

| Local | Atual | Proposta | Razão |
|-------|-------|----------|-------|
| Container (L121) | `space-y-3 py-4` | `space-y-4 py-3` | Mais separação entre msgs |

---

## Resumo de Mudanças

| Arquivo | Linhas | Tipo |
|---------|--------|------|
| `SuperComposer.tsx` | 648, 649, 702-710, 734 | className |
| `MessageBubble.tsx` | 141-142, 235 | className |
| `ChatWindow.tsx` | 603-604 | className |
| `MessagesWithMedia.tsx` | 121 | className |

---

## Garantias

- **Zero lógica tocada** — apenas Tailwind classes
- **Zero hooks alterados**
- **Zero handlers alterados**
- **Zero imports novos**

