

## Correcao: Visibilidade Bidirecional de Comentarios, Anexos e Status no Portal e CRM

### Problemas Identificados

1. **Portal do cliente nao mostra anexos**: A edge function `get-customer-tickets` busca comentarios mas NAO inclui o campo `attachments` na resposta. Quando o agente envia um comprovante/anexo, o cliente nao ve.

2. **Refresh quebrado apos cliente responder no portal**: Apos enviar um comentario, o `handleCommentAdded` tenta atualizar o ticket selecionado a partir do estado antigo (antes do fetch completar), causando um race condition onde a resposta recem-enviada nao aparece.

3. **Portal nao mostra mudancas de status no historico**: O cliente so ve o status atual no header, mas nao ve eventos como "Aguardando Cliente", "Resolvido", etc. no historico de mensagens.

4. **Portal nao renderiza anexos**: O componente `MyTicketDetail` nao tem logica para exibir anexos nos comentarios.

### Alteracoes

**1. Edge function `get-customer-tickets`** — Incluir attachments nos comentarios

Adicionar `attachments` na query de comentarios e incluir no retorno. Atualmente a query seleciona `id, ticket_id, content, created_at, is_internal, source, created_by` — falta `attachments`.

Tambem incluir eventos de status (status_changed, resolved, closed) da tabela `ticket_events` para o cliente ver a timeline de mudancas.

**2. Componente `MyTicketDetail.tsx`** — Exibir anexos e eventos de status

- Adicionar renderizacao de anexos nos comentarios (imagens inline, links para download)
- Adicionar eventos de status intercalados no historico (ex: "Status alterado para Aguardando Cliente")
- Atualizar interface `TicketComment` para incluir campo `attachments`

**3. Componente `MyTickets.tsx`** — Corrigir refresh apos enviar comentario

O `handleCommentAdded` faz `fetchTickets()` mas depois tenta pegar o ticket atualizado do array ANTIGO. Corrigir para:
- Fazer fetch e aguardar resultado
- Atualizar `selectedTicket` com os dados novos do fetch

**4. Edge function `get-customer-tickets`** — Incluir eventos de status

Adicionar query na tabela `ticket_events` para buscar eventos relevantes (status_changed, resolved, closed, assigned) e retornar junto com o ticket, para o portal poder exibir uma timeline de atualizacoes.

### Detalhes Tecnicos

**get-customer-tickets/index.ts** — mudancas:
```text
// Na query de comentarios, adicionar attachments:
.select(`id, ticket_id, content, created_at, is_internal, source, created_by, attachments, ...`)

// No mapeamento de comentarios:
acc[comment.ticket_id].push({
  ...campos_existentes,
  attachments: comment.attachments || []
});

// Nova query: buscar eventos de status
const { data: events } = await supabase
  .from('ticket_events')
  .select('id, ticket_id, event_type, created_at, metadata')
  .in('ticket_id', ticketIds)
  .in('event_type', ['status_changed', 'resolved', 'closed'])
  .order('created_at', { ascending: true });

// Retornar events junto com cada ticket
```

**MyTicketDetail.tsx** — mudancas:
```text
// Interface TicketComment: adicionar attachments
attachments?: Array<{ url: string; name: string; type: string; size: number }>;

// Interface CustomerTicket: adicionar events
events?: Array<{ id: string; event_type: string; created_at: string; metadata: any }>;

// Renderizacao: intercalar comentarios + eventos por data
// Anexos: exibir imagens inline e links para download
```

**MyTickets.tsx** — correcao de refresh:
```text
const handleCommentAdded = async () => {
  await fetchTickets(); // aguardar
  // selectedTicket sera atualizado via useEffect ou re-fetch
};
```

### Impacto
- Zero impacto em funcionalidades internas do CRM
- Melhora visibilidade bidirecional: agente ve respostas do cliente, cliente ve respostas do agente com anexos e mudancas de status
- Kill Switch, Shadow Mode, CSAT, distribuicao: nao afetados
- Todos os tickets antigos serao beneficiados pois os dados ja existem no banco

