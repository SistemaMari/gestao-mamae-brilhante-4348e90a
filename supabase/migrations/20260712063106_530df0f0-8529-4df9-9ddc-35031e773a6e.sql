DROP MATERIALIZED VIEW IF EXISTS mv_admin_resumo_global CASCADE;
CREATE MATERIALIZED VIEW mv_admin_resumo_global AS
SELECT 1 AS singleton,
  (SELECT count(*)::int FROM profissionais) AS total_profissionais,
  (SELECT count(*)::int FROM unidades) AS total_unidades,
  (SELECT count(*)::int FROM gestores_gerais) AS total_gestores_gerais,
  (SELECT count(*)::int FROM profissionais WHERE perfil_institucional = 'gestor') AS total_gestores_unidade,
  (SELECT count(*)::int FROM consolidacoes) AS total_consolidacoes,
  (SELECT count(*)::int FROM pacientes) AS total_pacientes,
  (SELECT count(*)::int FROM laudos) AS total_laudos,
  now() AS atualizado_em;
CREATE UNIQUE INDEX ON mv_admin_resumo_global (singleton);
GRANT SELECT ON mv_admin_resumo_global TO authenticated, service_role;
REFRESH MATERIALIZED VIEW mv_admin_resumo_global;