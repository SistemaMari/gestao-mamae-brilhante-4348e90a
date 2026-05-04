-- Cron jobs para refresh das views materializadas
-- Idempotente: desagenda antes de criar de novo

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_admin_views_hourly') THEN
    PERFORM cron.unschedule('refresh_admin_views_hourly');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'refresh_admin_alertas_10min') THEN
    PERFORM cron.unschedule('refresh_admin_alertas_10min');
  END IF;
END
$$;

SELECT cron.schedule(
  'refresh_admin_views_hourly',
  '0 * * * *',
  $cron$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_profissionais_ativos_30d;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_admin_resumo_global;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_admin_distribuicao_geografica;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_admin_top_cidades;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_admin_unidades_resumo;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_admin_profissionais_por_plano;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_admin_evolucao_mensal_planos;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_admin_evolucao_mensal_profissionais;
  $cron$
);

SELECT cron.schedule(
  'refresh_admin_alertas_10min',
  '*/10 * * * *',
  $cron$
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_profissionais_ativos_30d;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_admin_alertas_operacionais;
  $cron$
);