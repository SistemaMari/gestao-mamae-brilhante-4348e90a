-- Cria o pg_cron job para processar a fila de emails a cada minuto.
-- Usa app.settings.service_role_key (mesma convenção dos outros cron jobs do projeto).
SELECT cron.unschedule('process-email-queue')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-email-queue'
);

SELECT cron.schedule(
  'process-email-queue',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ywldvotfgbxufcyjdvnq.supabase.co/functions/v1/process-email-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);
