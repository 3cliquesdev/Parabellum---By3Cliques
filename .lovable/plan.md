
# Notificacao Email Interna para Stakeholders ao Criar Ticket

## Resumo

Quando um ticket for criado (via modal ou via conversa), todos os envolvidos (created_by, assigned_to, stakeholders) receberao email interno via `send-email`. Inclui tabela de dedupe para evitar emails duplicados em retry/double-click.

## Mudancas

### 1. Migration: Tabela de dedupe + role "watcher" em stakeholders

- Criar tabela `ticket_notification_sends` para evitar envio duplicado
- Adicionar role "watcher" ao CHECK constraint de `ticket_stakeholders` (para uso futuro)

```sql
CREATE TABLE IF NOT EXISTS public.ticket_notification_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_event_id UUID NOT NULL REFERENCES public.ticket_events(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email','in_app')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(ticket_event_id, recipient_user_id, channel)
);

CREATE INDEX idx_ticket_notification_sends_event ON ticket_notification_sends(ticket_event_id);
CREATE INDEX idx_ticket_notification_sends_recipient ON ticket_notification_sends(recipient_user_id);

ALTER TABLE ticket_notification_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON ticket_notification_sends FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated can read" ON ticket_notification_sends FOR SELECT TO authenticated USING (true);
```

### 2. useCreateTicket.tsx - Adicionar stakeholders + evento + notify

Apos criar o ticket e inserir tags, adicionar:
- Upsert stakeholders (creator + assignee)
- Insert `ticket_events` com `event_type = 'created'`
- Chamar `notify-ticket-event` com `ticket_event_id` e `channels: ["email", "in_app"]`

### 3. generate-ticket-from-conversation/index.ts - Mesmo padrao

Apos criar o ticket (step 6), antes do email ao cliente (step 9):
- Insert `ticket_events` com `event_type = 'created'`
- Chamar `notify-ticket-event` com `ticket_event_id`

### 4. notify-ticket-event/index.ts - Adicionar envio de email

Mudancas principais:
- Aceitar novo campo `ticket_event_id` e `channels` no payload
- Adicionar `'created'` ao `notifiableEvents`
- Para `event_type === 'created'`: incluir o **actor** (criador) na lista de recipients (nao excluir)
- Para cada recipient com email: verificar dedupe via `ticket_notification_sends`, enviar email via `send-email`
- Template HTML do email: assunto "Novo ticket criado - [subject]", corpo com link para o ticket

Logica de recipients para `created`:
```
recipientIds = DISTINCT de:
  - created_by (incluso, nao excluido)
  - assigned_to (se existir)
  - todos ticket_stakeholders.user_id
```

Para outros eventos, manter comportamento atual (excluir actor).

### 5. Frontend: useCreateTicket.tsx - Ajuste no fluxo

O `notify-ticket-event` ja sera chamado no `mutationFn` (nao no `onSuccess`) para garantir que o `ticket_event_id` esteja disponivel.

## Secao Tecnica

### Arquivos modificados
| Arquivo | Tipo de mudanca |
|---------|----------------|
| Migration SQL | Nova tabela `ticket_notification_sends` |
| `src/hooks/useCreateTicket.tsx` | Adicionar stakeholders + evento + notify |
| `supabase/functions/generate-ticket-from-conversation/index.ts` | Adicionar evento + notify |
| `supabase/functions/notify-ticket-event/index.ts` | Adicionar envio email + dedupe + tipo `created` |

### Fluxo completo ao criar ticket

```
useCreateTicket / generate-ticket-from-conversation
  |
  +-- INSERT tickets
  +-- UPSERT ticket_stakeholders (creator + assignee)
  +-- INSERT ticket_events (event_type: 'created') --> retorna event.id
  +-- INVOKE notify-ticket-event({ ticket_id, event_type: 'created', ticket_event_id })
        |
        +-- Buscar ticket (subject, number, etc)
        +-- Coletar recipients: created_by + assigned_to + stakeholders (DISTINCT)
        +-- Para cada recipient:
        |     +-- UPSERT ticket_notification_sends (dedupe)
        |     +-- Se inseriu (nao duplicado): INVOKE send-email
        +-- Criar notifications in-app (existente)
        +-- Retornar { success, emails_sent, notifications_created }
```

### Template do email interno

- Subject: `Novo ticket criado - [subject]`
- Sem emojis no subject (reduz spam score)
- From: `contato@mail.3cliques.net` (via send-email, ja unificado)
- Body: HTML limpo com subject, prioridade, status, link para abrir o ticket

### Impacto
- Zero mudanca em comportamento existente (upgrade only)
- Emails so sao enviados 1x por evento+recipient+channel (dedupe)
- Se `send-email` falhar, o ticket ja foi criado - nao quebra o fluxo
- Redeploy necessario: `notify-ticket-event`, `generate-ticket-from-conversation`
