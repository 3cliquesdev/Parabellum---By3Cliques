

# Plano: Corrigir cron job — service_role_key não disponível via current_setting

## Diagnóstico

Testei ambas as variantes:
- `current_setting('app.settings.service_role_key', true)` → **NULL**
- `current_setting('supabase.service_role_key', true)` → **NULL**

Isso significa que o cron atual gera `Authorization: Bearer null` — a função não autentica.

## Opções

### Opção A — Usar a anon key (recomendado)

A anon key é suficiente para invocar edge functions via gateway. A função `passive-learning-cron` internamente já usa `SUPABASE_SERVICE_ROLE_KEY` do seu próprio ambiente Deno para criar o client admin. O header Authorization no cron só serve para passar pelo API gateway — a anon key faz isso perfeitamente.

```sql
DELETE FROM cron.job WHERE jobname = 'passive-learning-hourly';

SELECT cron.schedule(
  'passive-learning-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zaeozfdjhrmblfaxsyuu.supabase.co/functions/v1/passive-learning-cron',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW96ZmRqaHJtYmxmYXhzeXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzcxODIsImV4cCI6MjA3OTQ1MzE4Mn0.lowOKwfcgxuGQPcWPEEw6TeCfXMR9h9EQRLAAs4mmZ0"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
```

### Opção B — Fornecer service_role_key direta

Se preferir usar a service_role_key por segurança extra, precisaria fornecer a chave manualmente (disponível em Settings → API). Eu a armazenaria diretamente no SQL do cron.

## Recomendação

**Opção A** — a anon key é segura para este caso (só autentica no gateway; a lógica admin está dentro da função). Evita depender de settings não configurados e é a abordagem padrão para cron → edge function.

## Resultado

Cron job passa a autenticar corretamente no gateway, função executa com permissões admin via seu próprio service_role_key interno.

