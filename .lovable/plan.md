

# Plano: ID de Protocolo Visível no Inbox

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico

O `short_id` já existe nos relatórios (derivado como `LEFT(conversation_id::TEXT, 8)`), mas **nunca aparece na interface do inbox** — nem na lista de conversas (`ConversationListItem`), nem no header do chat (`ChatWindow`).

A `inbox_view` (tabela materializada) também não possui coluna `short_id`. Os relatórios geram o valor on-the-fly via SQL.

## Solução

Abordagem em 2 camadas:

### 1. Banco de dados — Adicionar `short_id` na `inbox_view`

Criar migration que adiciona coluna `short_id TEXT` à tabela `inbox_view`, populada automaticamente com `LEFT(conversation_id::TEXT, 8)` (primeiros 8 caracteres do UUID, formato `#a1e17320`).

Também criar trigger para popular automaticamente em novos INSERTs e UPDATEs, garantindo que o valor esteja sempre presente.

### 2. Frontend — Exibir protocolo em 2 locais

**a) `ConversationListItem.tsx`** — Mostrar `#XXXXXXXX` discreto abaixo do nome do contato, na linha do preview ou badges:

```
Nome do Contato              2 min
#a1e17320 → Última mensagem...
[Cliente] [Comercial] [Agente]
```

O `short_id` será derivado diretamente do `conversation.id` no frontend (`conversation.id.slice(0, 8).toUpperCase()`), sem depender de campo extra do banco. Isso é mais simples e evita migration complexa.

**b) `ChatWindow.tsx`** — Mostrar o protocolo no header do chat, ao lado do nome do contato, como badge copiável (click-to-copy).

### 3. Busca — Já funciona

O `useInboxSearch` já busca por UUID completo. Buscar pelos 8 primeiros caracteres **não funcionaria** com a estratégia atual (requer UUID completo). Podemos adicionar suporte a busca parcial por short_id.

## Detalhamento técnico

| Arquivo | Mudança |
|---|---|
| `ConversationListItem.tsx` | Adicionar `#` + 8 chars do ID ao lado do preview da mensagem |
| `ChatWindow.tsx` | Adicionar badge de protocolo copiável no header |
| `useInboxSearch.tsx` | Adicionar estratégia para busca por short_id (8 hex chars) |

### Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — apenas adiciona informação visual |
| Kill Switch | Não afetado |
| Performance | Zero — derivado do ID existente, sem queries extras |
| Migration | Não necessária — tudo derivado client-side |

