-- Agendamento do resumo semanal por e-mail (job do pg_cron).
-- NÃO é migration: rodar à mão no SQL Editor do Supabase, só DEPOIS de
--   1) aplicar 20261015150000_resumo_semanal_email.sql,
--   2) implantar a edge function enviar-resumo-semanal,
--   3) testar com {"dry_run": true} e com {"somente_email": "..."}.
-- Segunda 10:00 UTC = 07:00 em Brasília.
-- Se o job do relatório mensal usar outro cabeçalho de autorização, copie o dele:
--   SELECT command FROM cron.job WHERE jobname ILIKE '%relatorio%';

SELECT cron.unschedule('enviar-resumo-semanal')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-resumo-semanal');

SELECT cron.schedule(
  'enviar-resumo-semanal',
  '0 10 * * 1',
  $cron$
  SELECT net.http_post(
    url := 'https://ywldvotfgbxufcyjdvnq.supabase.co/functions/v1/enviar-resumo-semanal',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'email_queue_service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

-- Para desligar tudo: SELECT cron.unschedule('enviar-resumo-semanal');
