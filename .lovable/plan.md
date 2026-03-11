

# Executar queries corrigidas em sequência

O usuário apontou corretamente que `cron.unschedule` falha se o job não existe. A solução é usar `DELETE FROM cron.job WHERE jobname = ...` que é seguro (não dá erro se não existir).

## Execução em 3 passos

### Query 1 — Liberar flow states presos agora
```sql
UPDATE public.chat_flow_states
SET status = 'transferred', completed_at = now()
WHERE status IN ('waiting_input', 'active', 'in_progress')
  AND started_at < now() - INTERVAL '3 minutes'
  AND conversation_id IN (
    SELECT id FROM public.conversations WHERE status = 'open'
  );
```

### Query 2 — Criar pg_cron job (com DELETE seguro em vez de unschedule)
```sql
CREATE EXTENSION IF NOT EXISTS pg_cron;

DELETE FROM cron.job WHERE jobname = 'cleanup-stuck-flow-states';

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

### Query 3 — Confirmar job criado
```sql
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'cleanup-stuck-flow-states';
```

### Query 4 — Verificação final de conversas órfãs
```sql
SELECT COUNT(*) AS sem_dispatch FROM public.conversations c
LEFT JOIN public.conversation_dispatch_jobs cj
  ON cj.conversation_id = c.id AND cj.status = 'pending'
WHERE c.ai_mode IN ('waiting_human', 'copilot')
  AND c.assigned_to IS NULL AND c.status = 'open' AND cj.id IS NULL;
```

## Implementação

Executar cada query separadamente via insert tool (data operations, não schema) na ordem acima. Usar `DELETE FROM cron.job` em vez de `cron.unschedule` para evitar erro na primeira execução.

