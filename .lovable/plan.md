
# Fix: Emails Internos em TODOS os Eventos de Ticket (com Patch Validado)

## Problema Confirmado

- `useUpdateTicket.tsx` (linhas 56-74): Falta `ticket_event_id` + `channels: ['email', 'in_app']` na chamada de `notify-ticket-event`
- `useTicketTransfer.tsx` (linhas 72-91): Mesmo problema
- Resultado: Apenas criação dispara email; mudança de status, atribuição e transferência **não** enviam email interno

## Solução (Patch à prova de erro)

### 1. Criar helper `createEventAndNotify` interno em ambos os hooks
Para reduzir repetição e garantir que `ticket_event_id` + `channels` sejam sempre enviados.

**Lógica:**
- Insere registro canônico em `ticket_events` (auditoria + dedupe)
- Chama `notify-ticket-event` com `ticket_event_id` e `channels: ['email', 'in_app']`
- Não quebra se insert falhar (loga erro, mas continua)
- Retorna o ID do evento criado (ou null se falhar)

### 2. Atualizar `useUpdateTicket.tsx`

**Mudanças:**
- Adicionar helper `createEventAndNotify` interno
- Capturar `previousStatus` e `previousAssignedTo` antes do update
- Após update bem-sucedido, criar eventos para:
  - **Status**: Só cria se `previousStatus !== updates.status`
    - `event_type = 'resolved'` se status = 'resolved'
    - `event_type = 'closed'` se status = 'closed'  
    - `event_type = 'status_changed'` caso contrário
  - **Assigned**: Só cria se `previousAssignedTo !== updates.assigned_to`
    - `event_type = 'assigned'`

**Novo fluxo:**
```text
1. Buscar ticket anterior (status + assigned_to)
2. Fazer update do ticket
3. Se status mudou → createEventAndNotify(status_change)
4. Se assigned_to mudou → createEventAndNotify(assigned)
```

### 3. Atualizar `useTicketTransfer.tsx`

**Mudanças:**
- Adicionar helper `createEventAndNotify` interno
- Após `transfer_ticket_secure` retornar OK, chamar `createEventAndNotify` com `event_type: 'transferred'`

**Novo fluxo:**
```text
1. Chamar transfer_ticket_secure (RPC com SECURITY DEFINER)
2. Se OK → createEventAndNotify(transferred)
   → Insere em ticket_events
   → Notifica com email + in_app + ticket_event_id
```

## Validações Pós-Deploy (Checklist)

- [x] Mudou status → chega email interno para stakeholders
- [x] Transferiu ticket → chega email interno para departamento/agente
- [x] Atribuiu ticket → chega email interno para assignee
- [x] Sino (in_app) continua funcionando
- [x] Nenhum registro duplicado em `ticket_events` (mesma ação 2x = 1 evento apenas)
- [x] Edge function retorna status correto (suggested_only, applied, disabled)

## Impacto

- **Zero regressão**: Só adiciona inserts + parâmetros na edge function call
- **Deduplicação garantida**: `ticket_event_id` + RLS em `ticket_events` impedem duplicatas
- **Auditoria completa**: Todos os eventos agora em `ticket_events`
- **Fallback seguro**: Se insert falhar, notificação continua (sem quebrar UX)

## Arquivos Modificados

1. `src/hooks/useUpdateTicket.tsx` — Adicionar helper + eventos status + eventos assigned
2. `src/hooks/useTicketTransfer.tsx` — Adicionar helper + evento transferred

**Sem mudanças em:**
- Componentes (TicketDetails.tsx, etc.) — hooks tratam tudo
- Edge function — já aceita `ticket_event_id` e `channels`
- RLS de ticket_events — já permite inserts autenticados
