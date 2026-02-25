

# Plano Ajustado: Email ao Cliente — Resolved + Comentários Públicos

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Mudanças

### 1. `supabase/functions/notify-ticket-event/index.ts` — Remover `closed`

Linha 467: alterar de `['created', 'resolved', 'closed']` para `['created', 'resolved']`.

### 2. `src/hooks/useCreateComment.tsx` — Notificar cliente em comentário público

Após o insert bem-sucedido (no `onSuccess`), adicionar lógica:

1. **Guarda `is_internal`**: se `variables.is_internal === true`, não faz nada
2. **Invocar `send-ticket-email-reply`** com `{ ticket_id: variables.ticket_id, message_content: data.content }`
   - A função `send-ticket-email-reply` já exige `ticket_id` + `message_content` (validação nas linhas 41-43)
   - Ela já busca o `customer_id` do ticket, o email do contato, aplica branding, e faz threading
   - Não é possível passar apenas `comment_id` porque a função não suporta — ela espera `message_content` como texto
3. **Tratamento de erro isolado**: envolver em `try/catch` — se falhar, exibir toast informativo ("Comentário salvo, mas email não enviado"), sem impedir o fluxo principal
4. Mover a invalidação de queries e o toast de sucesso para **antes** da tentativa de email, garantindo que o comentário é tratado como salvo independentemente

### 3. Template — Não criar

`send-ticket-email-reply` já tem template próprio com branding. Sem duplicação.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/notify-ticket-event/index.ts` | Linha 467: remover `'closed'` do array |
| `src/hooks/useCreateComment.tsx` | `onSuccess`: invocar `send-ticket-email-reply` para comentários públicos com error handling isolado |

## Critérios de aceite

| Critério | Status |
|---|---|
| Ticket closed não envia email ao cliente | Coberto pela remoção de `closed` |
| Ticket resolved envia email ao cliente | Já funciona (mantido) |
| Comentário público → cliente recebe email | Coberto pela invocação no `onSuccess` |
| Comentário interno → não envia | Coberto pelo guard `is_internal` |
| Falha no email não impede salvar comentário | Coberto pelo `try/catch` isolado |

## Impacto
- Zero regressão: comentários salvam normalmente, emails internos inalterados
- Upgrade: cliente passa a ser notificado de comentários públicos

