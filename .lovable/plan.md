

## Correcao: Status "Aguardando Cliente" ao Responder Ticket

### Problema

Quando um agente envia uma resposta publica em um ticket, o sistema:
1. Cria o comentario no banco
2. Envia email ao cliente via `send-ticket-email-reply`

Porem **nao atualiza o status do ticket para `waiting_customer`**. Isso significa que:
- O ticket permanece em `open` ou `in_progress`
- O cliente (ex: atendimentobabado@babadotop.com.br) nunca recebe a notificacao de "Precisamos da sua resposta"
- A edge function `send-ticket-status-notification` nunca e chamada com `waiting_customer`

Confirmacao nos dados: O ticket TK-2026-00613 do Babado Top mostra eventos `created` -> `comment_added` -> `resolved`, sem nenhum evento `waiting_customer` intermediario.

### Solucao

No componente `TicketChat.tsx`, apos enviar a resposta publica com sucesso (email enviado), atualizar automaticamente o status do ticket para `waiting_customer` (se o status atual permitir essa transicao).

Status que permitem transicao automatica para `waiting_customer`:
- `open`
- `in_progress`

Status que NAO devem ser alterados automaticamente:
- `resolved`, `closed` (ja encerrados)
- `waiting_customer` (ja esta nesse status)
- `pending_approval`, `returned` etc. (fluxos especiais)

### Alteracoes

**Arquivo: `src/components/TicketChat.tsx`**

No bloco de resposta publica (linhas 122-146), apos o envio do email com sucesso:

1. Buscar o status atual do ticket
2. Se o status for `open` ou `in_progress`, chamar `useUpdateTicket` para mudar para `waiting_customer`
3. Isso dispara automaticamente:
   - Evento em `ticket_events`
   - Notificacao via `notify-ticket-event` (email + in_app)
   - Notificacao de status via `send-ticket-status-notification` (email para o cliente)

Pseudocodigo da mudanca:

```text
// Apos email enviado com sucesso:
const { data: currentTicket } = await supabase
  .from("tickets")
  .select("status")
  .eq("id", ticketId)
  .single();

const autoTransitionStatuses = ['open', 'in_progress'];
if (currentTicket && autoTransitionStatuses.includes(currentTicket.status)) {
  await updateTicket.mutateAsync({
    id: ticketId,
    updates: { status: 'waiting_customer' },
    statusNote: 'Status atualizado automaticamente apos resposta do agente',
  });
}
```

**Dependencias**: O componente precisa receber o hook `useUpdateTicket` ou aceitar uma prop com a funcao de atualizacao. A abordagem mais limpa e importar `useUpdateTicket` diretamente dentro do `TicketChat`.

### Impacto

- Tickets respondidos passam automaticamente para "Aguardando Cliente"
- O cliente recebe email de notificacao com o template configurado para `waiting_customer`
- Quando o cliente responde (via `add-customer-comment`), o ticket volta para `open` (ja implementado)
- Kill Switch, Shadow Mode, CSAT, distribuicao: nao afetados
- Tickets ja em `resolved`/`closed` nao sao alterados (proteção contra reabrir indevida)
