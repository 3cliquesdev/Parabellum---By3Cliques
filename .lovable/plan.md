

# Liberar flow states presos + pg_cron automático

## Parte 1 — Liberar flow states presos (SQL imediato)

Executar via insert tool (operação de dados, não schema):

```sql
UPDATE public.chat_flow_states
SET status = 'transferred', completed_at = now()
WHERE status IN ('waiting_input', 'active', 'in_progress')
  AND started_at < now() - INTERVAL '3 minutes'
  AND conversation_id IN (
    SELECT id FROM public.conversations WHERE status = 'open'
  );
```

## Parte 2 — pg_cron job a cada 3 minutos

Executar via insert tool (não migration, pois contém dados específicos do projeto):

```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('cleanup-stuck-flow-states');

SELECT cron.schedule(
  'cleanup-stuck-flow-states',
  '*/3 * * * *',
  $$
    UPDATE public.chat_flow_states
    SET status = 'transferred', completed_at = now()
    WHERE status IN ('waiting_input', 'active', 'in_progress')
      AND started_at < now() - INTERVAL '3 minutes'
      AND conversation_id IN (
        SELECT id FROM public.conversations WHERE status = 'open'
      );
  $$
);
```

## Notas técnicas

- Ambas operações usam `started_at` como referência (confirmado: tabela não tem `updated_at`)
- O job cron garante limpeza contínua de flows presos sem intervenção manual
- Flows com mais de 3 min em estado ativo/waiting são marcados como `transferred` para liberar a conversa para atendimento humano

