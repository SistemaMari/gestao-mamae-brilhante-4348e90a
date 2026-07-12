
DROP MATERIALIZED VIEW IF EXISTS mv_admin_distribuicao_geografica CASCADE;
CREATE MATERIALIZED VIEW mv_admin_distribuicao_geografica AS
SELECT
  coalesce(pais, 'Brasil') AS pais,
  coalesce(estado, '—')    AS estado,
  coalesce(cidade, '—')    AS cidade,
  count(*)::int            AS total_profissionais
FROM public.profissionais
WHERE unidade_id IS NULL
GROUP BY 1, 2, 3;
CREATE UNIQUE INDEX idx_mv_distrib_pk
  ON mv_admin_distribuicao_geografica(pais, estado, cidade);

DROP MATERIALIZED VIEW IF EXISTS mv_admin_top_cidades CASCADE;
CREATE MATERIALIZED VIEW mv_admin_top_cidades AS
SELECT
  row_number() OVER (ORDER BY count(*) DESC, cidade)::int AS posicao,
  coalesce(pais, 'Brasil') AS pais,
  coalesce(estado, '—')    AS estado,
  coalesce(cidade, '—')    AS cidade,
  count(*)::int            AS total_profissionais
FROM public.profissionais
WHERE unidade_id IS NULL
GROUP BY pais, estado, cidade
ORDER BY total_profissionais DESC, cidade
LIMIT 20;
CREATE UNIQUE INDEX idx_mv_top_cidades_pk ON mv_admin_top_cidades(posicao);

REFRESH MATERIALIZED VIEW mv_admin_distribuicao_geografica;
REFRESH MATERIALIZED VIEW mv_admin_top_cidades;
