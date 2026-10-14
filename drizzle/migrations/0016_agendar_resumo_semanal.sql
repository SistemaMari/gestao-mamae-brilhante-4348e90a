SELECT cron.unschedule('enviar-resumo-semanal') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-resumo-semanal');

SELECT cron.schedule(
  'enviar-resumo-semanal',
  '0 10 * * 1',
  (SELECT replace(command, 'gerar-relatorios-mensais', 'enviar-resumo-semanal')
   FROM cron.job WHERE command ILIKE '%gerar-relatorios-mensais%' LIMIT 1)
);