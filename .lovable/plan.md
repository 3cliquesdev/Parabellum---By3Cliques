

# Plano: Corrigir cron job para usar service_role_key

## Problema
O cron job `passive-learning-hourly` atual usa a **anon key** no header Authorization. Edge functions que usam `SUPABASE_SERVICE_ROLE_KEY` internamente precisam ser invocadas com a service_role_key para funcionar corretamente.

## O que fazer

### 1. Deletar cron job atual
```sql
DELETE FROM cron.job WHERE jobname = 'passive-learning-hourly';
```

### 2. Recriar com service_role_key dinâmica
```sql
SELECT cron.schedule(
  'passive-learning-hourly',
  '0 * * * *',
  format(
    $$
    SELECT net.http_post(
      url := 'https://zaeozfdjhrmblfaxsyuu.supabase.co/functions/v1/passive-learning-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
    $$
  )
);
```

Se `current_setting` retornar null (não configurado no projeto), usarei a Query 2 do usuário com a service_role_key direta obtida via `secrets--fetch_secrets`.

### 3. Verificar
Confirmar que o job foi recriado corretamente.

## Resultado
Cron job passa a autenticar com service_role_key, garantindo que a edge function tenha permissões adequadas.

