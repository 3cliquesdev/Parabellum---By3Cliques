
## Correcao do Filtro "Mais Antigas Primeiro" no Inbox

### Problema Identificado

O filtro "Mais antigas primeiro" nao funciona por dois motivos:

1. **Ordenacao nunca aplicada na view compacta (mobile/tablet)**: Na linha 521 do `Inbox.tsx`, o componente `ConversationList` recebe `filteredConversations` (sem ordenacao) em vez de `orderedConversations` (com ordenacao). Isso significa que na view compacta a ordenacao e completamente ignorada.

2. **Logica de ordenacao "oldest" fragil na view desktop**: Na view desktop (linha 342-354), o codigo tenta reutilizar a ordem do array `inboxItems` (que vem do hook `useInboxView`), mas isso falha quando o usuario esta em filtros como "Fila Humana" porque os `activeItems` vem de outra fonte. Alem disso, `inboxItems` e ordenado por `updated_at` (que muda com qualquer atualizacao no sistema) e nao por `last_message_at` (que reflete quando o cliente realmente mandou a ultima mensagem).

### Solucao

Duas mudancas simples no arquivo `src/pages/Inbox.tsx`:

**Mudanca 1 - Simplificar a ordenacao "oldest"** (linhas 340-359):
- Remover a logica complexa de `indexById` que tenta reusar a ordem do `inboxItems`
- Substituir por uma ordenacao direta por `last_message_at` ascendente (mais antigo primeiro)
- Isso garante que funciona independente de qual hook/filtro esta ativo

**Mudanca 2 - View compacta usar `orderedConversations`** (linha 521):
- Trocar `filteredConversations` por `orderedConversations` na props do `ConversationList` da view compacta
- Isso garante que a ordenacao funciona tanto no mobile quanto no desktop

### O que NAO muda

- Todos os outros filtros (Minhas, Nao respondidas, SLA, etc.) continuam identicos
- A logica de filtros de tempo de espera (+1h, +4h, +24h, +7d) continua identica
- A ordenacao "Mais recentes primeiro" continua identica
- Nenhuma query ao banco e alterada
- Realtime, cache, Kill Switch, Shadow Mode nao sao afetados
