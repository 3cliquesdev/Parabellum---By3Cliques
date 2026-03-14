

# Fix: "Tempo Humano" só quando atendente humano inicia

## Problema

O métrica "Tempo Humano de Resolução" está sendo calculada mesmo em conversas resolvidas 100% pela IA, porque a query permite pegar mensagens de agente mesmo sem handoff.

## Causa

Na RPC `get_inbox_time_report`, a subquery `agfm` (primeira mensagem do agente) tem a condição:

```sql
(c.handoff_executed_at IS NULL OR m.created_at > c.handoff_executed_at)
```

Isso faz com que, quando não houve handoff (`IS NULL`), qualquer mensagem de agente seja considerada — gerando tempo humano em conversas que foram só IA.

## Correção

**Migração SQL** — alterar a condição na RPC para exigir que o handoff tenha acontecido:

```sql
-- De:
AND (c.handoff_executed_at IS NULL OR m.created_at > c.handoff_executed_at)

-- Para:
AND c.handoff_executed_at IS NOT NULL AND m.created_at > c.handoff_executed_at
```

## Resultado

- Conversas sem handoff → "Tempo Humano" aparece como "—"
- Conversas com handoff → calcula normalmente a partir da primeira mensagem do agente após o handoff
- Médias nos KPIs já ignoram NULLs automaticamente
- **Nenhuma alteração no frontend** necessária

