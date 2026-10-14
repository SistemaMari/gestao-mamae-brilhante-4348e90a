-- Agendamento do resumo semanal por e-mail (job do pg_cron).
-- NÃO é migration: rodar à mão no SQL Editor do Supabase, só DEPOIS de
--   1) aplicar 20261015150000_resumo_semanal_email.sql,
--   2) implantar a edge function enviar-resumo-semanal,
--   3) testar com {"dry_run": true} e com {"somente_email": "..."}.
--
-- Não guarda nenhuma chave neste arquivo: copia o comando do job do RELATÓRIO
-- MENSAL (que já autentica do jeito que a função espera) e só troca o nome da
-- função chamada. Segunda 10:00 UTC = 07:00 em Brasília.

-- 1) Confere o job de origem (precisa devolver exatamente 1 linha):
SELECT jobname, schedule FROM cron.job WHERE command ILIKE '%gerar-relatorios-mensais%';

-- 2) (Re)cria o agendamento semanal a partir dele:
SELECT cron.unschedule('enviar-resumo-semanal')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'enviar-resumo-semanal');

SELECT cron.schedule(
  'enviar-resumo-semanal',
  '0 10 * * 1',
  (SELECT replace(command, 'gerar-relatorios-mensais', 'enviar-resumo-semanal')
   FROM cron.job WHERE command ILIKE '%gerar-relatorios-mensais%' LIMIT 1)
);

-- 3) Confere:
SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'enviar-resumo-semanal';

-- Para desligar tudo: SELECT cron.unschedule('enviar-resumo-semanal');
