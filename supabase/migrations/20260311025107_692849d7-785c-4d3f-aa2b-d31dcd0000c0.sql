SELECT cron.schedule(
  'detect-kb-gaps-daily',
  '0 8 * * *',
  $$
  SELECT net.http_post(
    url := 'https://zaeozfdjhrmblfaxsyuu.supabase.co/functions/v1/detect-kb-gaps',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZW96ZmRqaHJtYmxmYXhzeXV1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM4NzcxODIsImV4cCI6MjA3OTQ1MzE4Mn0.lowOKwfcgxuGQPcWPEEw6TeCfXMR9h9EQRLAAs4mmZ0"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);