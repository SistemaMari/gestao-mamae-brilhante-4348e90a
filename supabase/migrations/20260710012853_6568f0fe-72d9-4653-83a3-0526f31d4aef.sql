DROP MATERIALIZED VIEW IF EXISTS mv_admin_resumo_global CASCADE;

CREATE MATERIALIZED VIEW mv_admin_resumo_global AS
SELECT
  1::int AS singleton,
  (SELECT count(*)::int FROM public.profissionais)   AS total_profissionais,
  (SELECT count(*)::int FROM public.unidades)        AS total_unidades,
  (SELECT count(*)::int FROM public.gestores_gerais) AS total_gestores_gerais,
  (SELECT count(*)::int FROM public.consolidacoes)   AS total_consolidacoes,
  (SELECT count(*)::int FROM public.pacientes)       AS total_pacientes,
  (SELECT count(*)::int FROM public.laudos)          AS total_laudos,
  now() AS atualizado_em;

CREATE UNIQUE INDEX idx_mv_resumo_global_pk ON mv_admin_resumo_global(singleton);

REFRESH MATERIALIZED VIEW mv_admin_resumo_global;