
# Plano: Corrigir Busca que não Encontra Conversa Ativa

## Problema Identificado

Quando o usuario esta no filtro "Minhas" (`/inbox?filter=mine`) e digita uma busca (ex: `fabiosou1542@gmail.com`), a conversa ativa **nao aparece** mesmo existindo no banco.

### Causa Raiz

A ordem das condicoes no `filteredConversations` esta incorreta:

```typescript
// ORDEM ATUAL (PROBLEMATICA)
1. if (filter === "not_responded") { return ... }  // Retorna sem verificar busca
2. if (filter === "mine") { return ... }           // Retorna sem verificar busca  
3. if (hasActiveSearch) { return ... }             // Nunca chega aqui quando filter=mine
```

Quando o usuario esta em "Minhas" e busca, o codigo:
1. Entra em `filter === "mine"`
2. Usa `sourceInboxItems` que vem de `rawInboxItems` (SEM filtro de busca)
3. Retorna conversas que NAO passaram pelo filtro de busca
4. A conversa buscada nao aparece

### Conversa Afetada
- ID: `054ac019-9ee4-444c-aa0f-f38a39202368`
- Contato: Ronildo Oliveira / fabiosou1542@gmail.com
- Status: **open** (confirmado no banco)
- assigned_to: usuario atual

---

## Solucao

Mover a verificacao de busca (`hasActiveSearch`) para **ANTES** dos filtros especiais, garantindo que a busca tenha prioridade absoluta.

### Mudanca no Arquivo: `src/pages/Inbox.tsx`

**Antes (linhas 243-286):**
```typescript
const filteredConversations = useMemo(() => {
  const fullConversations = conversations ?? [];
  const sourceInboxItems = rawInboxItems ?? inboxItems;
  
  // 1. not_responded primeiro (ignora busca)
  if (filter === "not_responded") { ... }
  
  // 2. mine segundo (ignora busca)
  if (filter === "mine") { ... }
  
  // 3. busca por ultimo (nunca chega se filter=mine)
  if (hasActiveSearch && inboxItems) { ... }
```

**Depois (corrigido):**
```typescript
const filteredConversations = useMemo(() => {
  const fullConversations = conversations ?? [];
  const sourceInboxItems = rawInboxItems ?? inboxItems;
  
  // BUSCA GLOBAL - PRIORIDADE MAXIMA
  // Quando ha busca ativa, SEMPRE usar inboxItems (que ja passou pelo filtro de busca)
  // Isso ignora qualquer filtro de categoria (mine, not_responded, etc)
  const hasActiveSearch = filters.search && filters.search.trim().length > 0;
  if (hasActiveSearch && inboxItems) {
    const searchResults = inboxItems.map(item => {
      const fullConv = fullConversations.find(c => c.id === item.conversation_id);
      return fullConv || inboxItemToConversation(item);
    }).filter(Boolean);
    return searchResults;
  }
  
  // Filtros especiais (somente quando NAO ha busca)
  if (filter === "not_responded") { ... }
  if (filter === "mine") { ... }
  
  // Outros filtros...
```

---

## Fluxo Corrigido

```
Usuario em "Minhas" (/inbox?filter=mine)
          |
          v
Digita "fabiosou1542@gmail.com" na busca
          |
          v
+----------------------------------+
| hasActiveSearch = true           |
| (VERIFICA PRIMEIRO)              |
|                                  |
| -> Usa inboxItems (com busca)    |
| -> inboxItems contem a conversa  |
| -> Retorna resultado da busca    |
+----------------------------------+
          |
          v
   Lista mostra a conversa
   (Ronildo Oliveira - status: open)
```

---

## Arquivos Afetados

| Arquivo | Mudanca |
|---------|---------|
| `src/pages/Inbox.tsx` | Mover verificacao `hasActiveSearch` para antes dos filtros especiais |

---

## Validacao Pos-Implementacao

1. Abrir Inbox em "Minhas" (`/inbox?filter=mine`)
2. Digitar `fabiosou1542` na busca
3. **Esperado**: Conversa aberta de Ronildo Oliveira aparece (status: open)
4. **Antes do fix**: Aparecia apenas conversas fechadas

Testes adicionais:
- Buscar em "Todas" - continua funcionando
- Buscar em "Nao respondidas" - continua funcionando  
- Buscar em "Fila IA" - continua funcionando
- Limpar busca - volta para o filtro original

---

## Conformidade com Regras

- **Upgrade, nao downgrade**: Melhora a busca sem quebrar filtros
- **Zero regressao**: Filtros continuam funcionando quando nao ha busca
- **Read-only**: Nenhuma escrita no banco (apenas leitura)
- **Soberania da busca**: Busca agora tem prioridade sobre filtros de categoria
