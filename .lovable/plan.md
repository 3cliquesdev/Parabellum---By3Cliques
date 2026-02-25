

# Plano Refinado: "Não Respondidas" — Fix Trigger + Backfill + Frontend

Analisei o projeto atual e sigo as regras da base de conhecimento.

## Diagnóstico Confirmado

A função `update_inbox_view_on_message_insert()` (linha 137 da migration `20260122`) faz:

```sql
last_sender_type = NEW.sender_type
```

Isso significa que mensagens `system` (ex: "Atendente X entrou na conversa") sobrescrevem `last_sender_type`, tirando a conversa do filtro "Não respondidas" (`last_sender_type = 'contact'`).

Os `sender_type` válidos no enum são: `user`, `contact`, `system`.

## Implementação em 3 Fases

### Fase A — Trigger (fix definitivo)

**Migration SQL** — Recriar `update_inbox_view_on_message_insert()` com guarda:

```sql
last_sender_type = CASE
  WHEN NEW.sender_type IN ('contact', 'user') THEN NEW.sender_type::TEXT
  ELSE last_sender_type  -- mantém valor anterior para 'system' e qualquer outro
END
```

Mesma lógica aplicada no upsert da função `update_inbox_view_on_message()` (a função principal que faz INSERT ... ON CONFLICT):

```sql
last_sender_type = CASE
  WHEN EXCLUDED.last_sender_type IN ('contact', 'user') THEN EXCLUDED.last_sender_type
  ELSE inbox_view.last_sender_type
END
```

Isso garante que **apenas mensagens reais** (cliente ou agente) alteram o `last_sender_type`. Mensagens de sistema, notas internas, ou qualquer tipo futuro são ignoradas.

### Fase B — Backfill de dados legados

**Migration SQL** — Corrigir conversas que ficaram "presas" com `last_sender_type = 'system'`:

```sql
UPDATE inbox_view iv
SET last_sender_type = sub.real_sender_type
FROM (
  SELECT DISTINCT ON (m.conversation_id)
    m.conversation_id,
    m.sender_type::TEXT AS real_sender_type
  FROM messages m
  WHERE m.sender_type IN ('contact', 'user')
  ORDER BY m.conversation_id, m.created_at DESC
) sub
WHERE sub.conversation_id = iv.conversation_id
  AND iv.last_sender_type = 'system';
```

Isso pega a última mensagem real (não-system) de cada conversa e restaura o `last_sender_type` correto.

### Fase C — Frontend e Counts (filtro puro, sem fallback)

Com o trigger corrigido (Fase A) e os dados legados limpos (Fase B), **não precisamos do fallback `IN ('contact', 'system')`**. O filtro permanece limpo:

- `useMyNotRespondedInboxItems.tsx`: mantém `.eq("last_sender_type", "contact")` — sem mudança
- `get-inbox-counts/index.ts`: mantém `.eq("last_sender_type", "contact")` — sem mudança

**Nenhuma alteração no frontend ou na edge function é necessária.** O fix é 100% no banco.

## Arquivos a Alterar

| Arquivo | Mudança |
|---|---|
| **Migration SQL (única)** | Recriar ambas as funções de trigger com guarda `IN ('contact','user')` + backfill de legados |

## Impacto

| Regra | Status |
|---|---|
| Regressão zero | Sim — triggers existentes apenas ganham guarda, sem remoção de lógica |
| Kill Switch | Não afetado |
| Fluxos existentes | Preservados |
| Badge/counts consistência | Sim — critério `contact` permanece consistente entre hook e edge function |
| Dados legados | Corrigidos pelo backfill na mesma migration |

## Fluxo Corrigido

```text
1. Cliente envia msg        → last_sender_type = 'contact'     ✅ aparece em "Não respondidas"
2. Sistema: "Agente entrou" → last_sender_type = 'contact'     ✅ permanece (trigger ignora 'system')
3. Agente responde          → last_sender_type = 'user'        ✅ sai de "Não respondidas"
4. Cliente responde de novo → last_sender_type = 'contact'     ✅ volta para "Não respondidas"
```

